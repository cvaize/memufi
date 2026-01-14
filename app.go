package main

import (
	"bytes"
	"context"
	"github.com/davecgh/go-spew/spew"
	"github.com/labstack/gommon/log"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetSeparator Returns the directory separator
func (a *App) GetSeparator() string {
	return string(filepath.Separator)
}

// GetPwd Возвращает текущую директорию, в которой запущена программа
func (a *App) GetPwd() string {
	pwd, err := os.Getwd()
	if err != nil {
		log.Errorf("GetPwd() Error: %v", err)
		panic(err)
	}
	return pwd
}

// GetDirectoryTree returns a list of files and directories, and an error, if any.
func (a *App) GetDirectoryTree(root string) DirectoryTreeResponse {
	entries, err := os.ReadDir(root)
	if err != nil {
		log.Errorf("GetDirectoryTree() Error: %v . Root: %s", err, root)
		return DirectoryTreeResponse{Items: []string{}, Error: err.Error()}
	}

	var dirs []string
	var files []string
	for i := range entries {
		if entries[i].IsDir() {
			dirs = append(dirs, entries[i].Name()+a.GetSeparator())
		} else {
			files = append(files, entries[i].Name())
		}
	}

	sort.Slice(dirs, func(i, j int) bool {
		return strings.ToLower(dirs[i]) < strings.ToLower(dirs[j])
	})
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i]) < strings.ToLower(files[j])
	})

	items := append(dirs, files...)

	return DirectoryTreeResponse{Items: items, Error: ""}
}

// Generate combines files into one.
func (a *App) Generate(root, output string, include, exclude []string) string {
	spew.Dump("root", root)
	spew.Dump("output", output)
	spew.Dump("include", include)
	spew.Dump("exclude", exclude)
	root = filepath.Clean(root)

	var treeLines []string
	var fileContents bytes.Buffer

	type node struct {
		name     string
		fullPath string
		isDir    bool
		children []*node
	}

	rootNode := &node{
		name:     filepath.Base(root),
		fullPath: root,
		isDir:    true,
	}

	var fullDirectoryInclude []string
	for _, s1 := range include {
		if strings.HasSuffix(s1, string(filepath.Separator)) {
			is := true
			for _, s2 := range include {
				if s2 != s1 && strings.HasPrefix(s2, s1) {
					is = false
				}
			}
			if is {
				fullDirectoryInclude = append(fullDirectoryInclude, s1)
			}
		}
	}
	shouldInclude := func(path string, isDir bool) bool {
		for _, inc := range include {
			if inc == path {
				return true
			}
			if isDir && strings.TrimSuffix(inc, string(filepath.Separator)) == path {
				return true
			}
		}
		for _, inc := range fullDirectoryInclude {
			if strings.HasPrefix(path, filepath.Clean(inc)) {
				return true
			}
		}
		return false
	}

	matchExclude := func(path string, isDir bool) bool {
		base := filepath.Base(path)

		for _, ex := range exclude {
			// directory exclude
			if strings.HasSuffix(ex, string(filepath.Separator)) {
				if isDir && base == strings.TrimSuffix(ex, string(filepath.Separator)) {
					return true
				}
				continue
			}

			ok, _ := filepath.Match(ex, base)
			if ok {
				return true
			}
		}
		return false
	}

	isBinary := func(path string) bool {
		f, err := os.Open(path)
		if err != nil {
			return true
		}
		defer f.Close()

		buf := make([]byte, 8000)
		n, _ := f.Read(buf)
		return !utf8.Valid(buf[:n])
	}

	var buildTree func(parent *node, path string) error
	buildTree = func(parent *node, path string) error {
		entries, err := os.ReadDir(path)
		if err != nil {
			return err
		}

		for _, e := range entries {
			full := filepath.Join(path, e.Name())

			if !shouldInclude(full, e.IsDir()) {
				continue
			}

			if matchExclude(full, e.IsDir()) {
				continue
			}

			if e.IsDir() {
				n := &node{name: e.Name(), fullPath: full, isDir: true}
				parent.children = append(parent.children, n)
				if err := buildTree(n, full); err != nil {
					return err
				}
				continue
			}

			parent.children = append(parent.children, &node{
				name:     e.Name(),
				fullPath: full,
				isDir:    false,
			})
		}
		return nil
	}

	if err := buildTree(rootNode, root); err != nil {
		return err.Error()
	}

	var renderTree func(n *node, prefix string, last bool)
	renderTree = func(n *node, prefix string, last bool) {
		connector := "├── "
		nextPrefix := prefix + "│   "
		if last {
			connector = "└── "
			nextPrefix = prefix + "    "
		}

		if n != rootNode {
			s := prefix + connector + n.name
			if n.isDir {
				s += "/"
			}
			treeLines = append(treeLines, s)
		}

		for i, c := range n.children {
			renderTree(c, nextPrefix, i == len(n.children)-1)
		}
	}

	treeLines = append(treeLines, "Directory structure:")
	treeLines = append(treeLines, "└── "+rootNode.name+"/")
	for i, c := range rootNode.children {
		renderTree(c, "    ", i == len(rootNode.children)-1)
	}

	var walkFiles func(n *node) error
	walkFiles = func(n *node) error {
		if !n.isDir {
			fileContents.WriteString("\n\n")
			fileContents.WriteString(strings.Repeat("=", 48) + "\n")
			fileContents.WriteString("FILE: " + rootNode.name + strings.ReplaceAll(n.fullPath, root, "") + "\n")
			fileContents.WriteString(strings.Repeat("=", 48) + "\n")

			if isBinary(n.fullPath) {
				fileContents.WriteString("[Binary file]\n")
				return nil
			}

			b, err := os.ReadFile(n.fullPath)
			if err != nil {
				return err
			}
			fileContents.Write(b)
			fileContents.WriteString("\n")
			return nil
		}

		for _, c := range n.children {
			if err := walkFiles(c); err != nil {
				return err
			}
		}
		return nil
	}

	if err := walkFiles(rootNode); err != nil {
		return err.Error()
	}

	var out bytes.Buffer
	out.WriteString(strings.Join(treeLines, "\n"))
	out.WriteString("\n\n\n")
	out.WriteString(fileContents.String())

	if err := os.WriteFile(output, out.Bytes(), fs.ModePerm); err != nil {
		return err.Error()
	}

	return ""
}
