(function () {
    if (window.Autosize) {
        let elements = document.querySelectorAll(".js-autosize-textarea");
        if (elements.length) {
            for (let i = 0; i < elements.length; i++) {
                elements[i].style.resize = 'none';
            }
            window.Autosize(elements);
        }
    }
    const autosizeUpdateEvent = new CustomEvent('autosize:update', {});

    let rootInput = document.getElementById("root-input");
    let refreshBtn = document.getElementById("refresh-btn");
    let excludeInput = document.getElementById("exclude-input");
    let outputInput = document.getElementById("output-input");
    let generateBtn = document.getElementById("generate-btn");
    let treeViewEl = document.getElementById("tree-view");


    let defaultSeparator = '/';
    let defaultRoot = '/home/';
    let defaultOutput = '/home/code_for_llm.txt';
    let defaultExcluded = [
        '*.exe', '*.exe~', '*.dll', '*.so', '*.dylib', '*.test', '*.out', 'coverage.*', '*.coverprofile',
        'profile.cov', '.env', '.git/', '.idea/', '.vscode/', 'node_modules/', 'vendor/', 'go.work', 'go.work.sum'
    ];
    let defaultTreeChildren = [
        {
            "id": "/home/user_folder1/",
            "text": "user_folder1/",
            "children": [
                {
                    "id": "/home/user_folder1/sub_folder1",
                    "text": "sub_folder1/",
                    "children": [
                        {
                            "id": "/home/user_folder1/sub_folder1/file1.css",
                            "text": "file1.css"
                        },
                        {
                            "id": "/home/user_folder1/sub_folder1/file2.js",
                            "text": "file2.js"
                        },
                        { "id": "/home/user_folder1/sub_folder1/file2.exe", "text": "file2.exe" },
                        { "id": "/home/user_folder1/sub_folder1/file2.dll", "text": "file2.dll" },
                        { "id": "/home/user_folder1/sub_folder1/coverage.txt", "text": "coverage.txt" },
                        { "id": "/home/user_folder1/sub_folder1/go.work", "text": "go.work" },
                        { "id": "/home/user_folder1/sub_folder1/.env", "text": ".env" },
                    ]
                },
                {
                    "id": "/home/user_folder1/node_modules/",
                    "text": "node_modules/",
                    "children": [
                        {
                            "id": "/home/user_folder1/node_modules/file1.css",
                            "text": "file1.css"
                        },
                        {
                            "id": "/home/user_folder1/node_modules/file2.js",
                            "text": "file2.js"
                        },
                    ]
                },
                {
                    "id": "/home/user_folder1/.git/",
                    "text": ".git/",
                    "children": [
                        {
                            "id": "/home/user_folder1/.git/file1.css",
                            "text": "file1.css"
                        },
                        {
                            "id": "/home/user_folder1/.git/file2.js",
                            "text": "file2.js"
                        },
                    ]
                }
            ]
        },
        {
            "id": "/home/user_folder2/",
            "text": "user_folder2/",
            "children": []
        },
        {
            "id": "/home/user_folder3/",
            "text": "user_folder3/",
            "children": []
        },
        { "id": "/home/file.css", "text": "file.css" },
        { "id": "/home/file.exe", "text": "file.exe" }
    ];

    let separator = '';
    let root = "";
    let output = "";
    /** @var {string[]} **/
    let excluded = [];
    let treeChildren = [];
    let disabled = [];
    let treeInstance;

    let rootInputTimeout;
    rootInput.addEventListener("input", function () {
        clearTimeout(rootInputTimeout);
        rootInputTimeout = setTimeout(function () {
            root = rootInput.value;
            destroyTree();
            checkInputs();
        }, 300);
    });

    refreshBtn.addEventListener("click", function () {
        refreshRoot();
    });

    let excludeInputTimeout;
    excludeInput.addEventListener("input", function () {
        clearTimeout(excludeInputTimeout);
        excludeInputTimeout = setTimeout(function () {
            excluded = excludeInput.value.split(",").map((s) => s.trim()).filter(Boolean);
            changeTreeDisabled();
            checkInputs();
        }, 300);
    });

    function checkInputs() {
        refreshBtn.disabled = !root;
        generateBtn.disabled = !output || !treeInstance || treeInstance.getValues().length === 0;
    }

    let outputInputTimeout;
    outputInput.addEventListener("input", function () {
        clearTimeout(outputInputTimeout);
        outputInputTimeout = setTimeout(function () {
            output = outputInput.value.trim();
            checkInputs();
        }, 300);
    });

    generateBtn.addEventListener("click", function () {
        if (!treeInstance) return;
        let include = filterPaths(treeInstance.getValues(), excluded);
        if (!include.length) return;
        addLoading(generateBtn);
        disableInputs();
        if (isGo()) {
            Generate(root, output, include, excluded).then(function () {
                removeLoading(generateBtn);
                unDisableInputs();
            }).catch(function (e) {
                removeLoading(generateBtn);
                unDisableInputs();
                alert(e);
            });
        } else {
            setTimeout(function () {
                removeLoading(generateBtn);
                unDisableInputs();
                alert("Generate successful: " + output);
            }, 1000);
        }
    });

    init();

    function init() {
        excludeInput.value = defaultExcluded.join(", ");
        excluded = defaultExcluded;
        root = defaultRoot;
        output = defaultOutput;
        separator = defaultSeparator;
        rootInput.value = root;
        outputInput.value = output;
        treeChildren = defaultTreeChildren;
        addLoading(refreshBtn);
        disableInputs();
        if (isGo()) {
            GetSeparator().then(function (s) {
                separator = s
                GetPwd().then(function (p) {
                    /** @var {string} */
                    let _pwd = p;
                    let _root = root.trim();
                    let _output = output.trim();

                    if (!_pwd.endsWith(separator)) _pwd += separator;
                    if (!_root.endsWith(separator)) _root += separator;

                    if (!_output) {
                        _output = _pwd + "code_for_llm.txt";
                    }

                    if (_output.startsWith(_root)) {
                        _output = _output.replace(_root, _pwd);
                    }

                    root = _pwd;
                    output = _output;

                    rootInput.value = root;
                    outputInput.value = output;
                    treeChildren = [];
                    refreshRoot();
                }).catch(function (e) {
                    alert(e);
                    window.runtime.Quit();
                });
            }).catch(function (e) {
                alert(e);
                window.runtime.Quit();
            });
        } else {
            refreshRoot();
        }
    }

    function refreshRoot() {
        root = root.trim();
        if (!root.endsWith(separator)) {
            root += separator;
        }
        rootInput.value = root;

        addLoading(refreshBtn);
        disableInputs();
        if (isGo()) {
            GetDirectoryTree(root).then(function (t) {
                destroyTree();

                /** @var {string[]} */
                let _items = t;
                treeChildren = [];
                for (let i = 0; i < _items.length; i++) {
                    let item = _items[i].trim();
                    let treeItem = {
                        "id": root + item,
                        "text": item,
                    };
                    if (item.endsWith(separator)) treeItem.children = [];
                    treeChildren.push(treeItem);
                }

                initTree();
                unDisableInputs();
                removeLoading(refreshBtn);
            }).catch(function (e) {
                alert(e);
                window.runtime.Quit();
            });
        } else {
            setTimeout(function () {
                unDisableInputs();
                initTree();
                removeLoading(refreshBtn);
            }, 1000);
        }
    }

    function unDisableInputs() {
        rootInput.disabled = false;
        refreshBtn.disabled = false;
        excludeInput.disabled = false;
        outputInput.disabled = false;
        generateBtn.disabled = false;
        if (treeViewEl.classList.contains("memufi-disabled")) {
            treeViewEl.classList.remove("memufi-disabled");
        }
        updateAutosize();
    }

    function disableInputs() {
        rootInput.disabled = true;
        refreshBtn.disabled = true;
        excludeInput.disabled = true;
        outputInput.disabled = true;
        generateBtn.disabled = true;
        if (!treeViewEl.classList.contains("memufi-disabled")) {
            treeViewEl.classList.add("memufi-disabled");
        }
        updateAutosize();
    }

    function addLoading(el) {
        if (!el.classList.contains("memufi-loading")) {
            el.classList.add("memufi-loading")
        }
    }

    function removeLoading(el) {
        if (el.classList.contains("memufi-loading")) {
            el.classList.remove("memufi-loading")
        }
    }

    function changeTreeDisabled() {
        disabled = diffArrays(treeInstance.getValues(), filterPaths(treeInstance.getValues(), excluded));
        treeInstance.setDisables(disabled);
    }

    function initTree() {
        treeInstance = new window.Tree(treeViewEl, {
            data: [{id: root, text: root, children: treeChildren}],
            closeDepth: 0,
            values: [root],
            disabled: disabled,
            load: function (id) {
                return new Promise(function (resolve) {
                        if (isGo()) {
                            GetDirectoryTree(id).then(function (t) {
                                let _values = [];
                                /** @var {string[]} */
                                let _items = t;
                                for (let i = 0; i < _items.length; i++) {
                                    let item = _items[i].trim();
                                    let treeItem = {
                                        "id": id + item,
                                        "text": item,
                                    };
                                    if (item.endsWith(separator)) treeItem.children = [];
                                    _values.push(treeItem);
                                }
                                resolve(_values);
                            }).catch(function (e) {
                                alert(e);
                                resolve([]);
                            });
                        } else {
                            setTimeout(function () {
                                let _values = [];
                                let _index = {}
                                for (let i = 0; i < 5; i++) {
                                    let j = Math.round(Math.random() * 10);
                                    if (!_index[j]) {
                                        _index[j] = true;
                                        _values.push({ "id": id + "subDir"+j+"/", "text": "subDir"+j+"/", "children": [] });
                                    }
                                }

                                resolve(_values)
                            }, 1000)
                        }
                })
            },
            loaded: function () {
                let nodes = treeViewEl.querySelectorAll(".treejs-node")
                for (let i = 0; i < nodes.length; i++) {
                    if (!nodes[i].classList.contains("treejs-node__close")) {
                        nodes[i].classList.add("treejs-node__close")
                    }
                }
                nodes = treeViewEl.querySelectorAll(".treejs > .treejs-nodes > .treejs-node")
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i].classList.remove("treejs-node__close")
                }
                let switchers = treeViewEl.querySelectorAll(".treejs-switcher")
                for (let i = 0; i < switchers.length; i++) {
                    switchers[i].removeEventListener("click", switcherOnClickHandler)
                    switchers[i].addEventListener("click", switcherOnClickHandler)
                }
            },
            onChange: function () {
                disabled = diffArrays(this.getValues(), filterPaths(this.getValues(), excluded));
                this.setDisables(disabled);
            }
        });

        changeTreeDisabled();
    }

    function destroyTree() {
        treeViewEl.innerHTML = "";
        if (treeInstance) {
            // treeInstance.setValues([]);
            // treeInstance.setDisables([]);
            treeInstance = null;
        }
    }

    function diffArrays(arr1, arr2) {
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);

        // Элементы, которые есть в arr1, но нет в arr2
        const onlyIn1 = arr1.filter(item => !set2.has(item));

        // Элементы, которые есть в arr2, но нет в arr1
        const onlyIn2 = arr2.filter(item => !set1.has(item));

        // Объединяем результаты
        return [...onlyIn1, ...onlyIn2];
    }

    function filterPaths(paths, patterns) {
        // 1. Предварительно компилируем паттерны в Regex для скорости
        const rules = patterns.map(p => {
            const isDirRule = p.endsWith('/');
            // Убираем слеш в конце для обработки
            const raw = isDirRule ? p.slice(0, -1) : p;

            // Экранируем спецсимволы Regex (кроме *), например точку: . -> \.
            let escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

            // Заменяем * на Regex-аналог "любой символ кроме слеша"
            // * -> [^/]*
            const regexStr = escaped.replace(/\*/g, '[^/]*');

            if (isDirRule) {
                // Если правило для папки (например "node_modules/"), оно должно встречаться как сегмент пути
                // (^|/) означает начало строки или слеш
                // (/|$) означает слеш или конец строки
                return {
                    type: 'dir',
                    regexp: new RegExp(`(^|/)${regexStr}(/|$)`)
                };
            } else {
                // Если правило для файла, оно должно полностью совпадать с именем файла
                return {
                    type: 'file',
                    regexp: new RegExp(`^${regexStr}$`)
                };
            }
        });

        // 2. Фильтруем массив values
        return paths.filter(path => {
            // Определяем, является ли путь папкой
            const isPathDir = path.endsWith('/');

            // Получаем имя файла (последний сегмент пути)
            // Если путь заканчивается на /, split даст пустую строку в конце, фильтруем это
            const segments = path.split('/').filter(s => s !== '');
            const filename = segments.length > 0 ? segments[segments.length - 1] : '';

            // Проверяем путь по всем правилам исключения
            for (let rule of rules) {
                if (rule.type === 'dir') {
                    // Правила папок проверяем по всему пути (содержит ли путь эту папку)
                    if (rule.regexp.test(path)) {
                        return false; // Исключить
                    }
                } else {
                    // Правила файлов (например *.exe) применяем ТОЛЬКО если это не папка
                    // и проверяем только имя файла, а не весь путь
                    if (!isPathDir && rule.regexp.test(filename)) {
                        return false; // Исключить
                    }
                }
            }
            return true; // Оставить
        });
    }

    function switcherOnClickHandler(e) {
        let isClosed = e.target.parentNode.classList.contains("treejs-node__close")
        if (!isClosed) {
            let nodes = e.target.parentNode.querySelectorAll(".treejs-node")
            for (let i = 0; i < nodes.length; i++) {
                if (!nodes[i].classList.contains("treejs-node__close")) {
                    nodes[i].classList.add("treejs-node__close")
                }
            }
        }
    }

    function updateAutosize() {
        rootInput.dispatchEvent(autosizeUpdateEvent);
        excludeInput.dispatchEvent(autosizeUpdateEvent);
        outputInput.dispatchEvent(autosizeUpdateEvent);
    }

    function isGo() {
        return !!window['go'];
    }

    function GetDirectoryTree(root) {
        return new Promise(function (resolve, reject) {
            window['go']['main']['App']['GetDirectoryTree'](root).then(function (tree) {
                if (tree.Error) {
                    reject(tree.Error);
                } else {
                    resolve(tree.Items);
                }
            }).catch(function () {
                reject("An error occurred while retrieving the directory tree.");
            });
        });
    }

    function GetSeparator() {
        return new Promise(function (resolve, reject) {
            window['go']['main']['App']["GetSeparator"]().then(function (s) {
                resolve(s);
            }).catch(function () {
                reject("An error occurred while retrieving the current directory.");
            });
        });
    }

    function GetPwd() {
        return new Promise(function (resolve, reject) {
            window['go']['main']['App']["GetPwd"]().then(function (pwd) {
                resolve(pwd);
            }).catch(function () {
                reject("An error occurred while retrieving the current directory.");
            });
        });
    }

    // root, output string, include, exclude []string
    function Generate(root, output, include, exclude) {
        return new Promise(function (resolve, reject) {
            window['go']['main']['App']['Generate'](root, output, include, exclude).then(function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }).catch(function () {
                reject("An error occurred while generating the file.");
            });
        });
        return window['go']['main']['App']['Generate'](root, output, include, exclude);
    }
})();