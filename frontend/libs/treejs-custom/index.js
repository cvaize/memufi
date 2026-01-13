(function () {
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function uniq(arr) {
        let map = {};
        return arr.reduce((acc, item) => {
            if (!map[item]) {
                map[item] = true;
                acc.push(item);
            }
            return acc;
        }, []);
    }

    function empty(ele) {
        while (ele.firstChild) {
            ele.removeChild(ele.firstChild);
        }
    }

    function animation(duration, callback) {
        requestAnimationFrame(() => {
            callback.enter();
            requestAnimationFrame(() => {
                callback.active();
                setTimeout(() => {
                    callback.leave();
                }, duration);
            });
        });
    }

    function collapseFromLeaf(tree, leafNode) {
        try {
            let nodeLiElement = tree.liElementsById[leafNode.parent.id];
            if (!nodeLiElement.classList.contains('treejs-node__close'))
                nodeLiElement.getElementsByClassName('treejs-switcher')[0].click();
        } catch (error) {
            return;
        }
        if (leafNode.hasOwnProperty('parent'))
            collapseFromLeaf(tree, leafNode.parent);
    }

    function expandFromRoot(tree, root) {
        let nodeLiElement = tree.liElementsById[root.id];
        if (nodeLiElement.classList.contains('treejs-node__close'))
            nodeLiElement.getElementsByClassName('treejs-switcher')[0].click();
        if (root.hasOwnProperty('children'))
            for (let child of root.children)
                expandFromRoot(tree, child);
    }

    function Tree(container, options) {
        let defaultOptions = {
            selectMode: 'checkbox',
            values: [],
            disables: [],
            load: null,
            loaded: null,
            url: null,
            method: 'GET',
            closeDepth: null,
        };
        this.treeNodes = [];
        this.nodesById = {};
        this.leafNodesById = {};
        this.liElementsById = {};
        this.willUpdateNodesById = {};
        this.container = container;
        this.options = Object.assign(defaultOptions, options);

        Object.defineProperties(this, {
            values: {
                get() {
                    return this.getValues();
                },
                set(values) {
                    return this.setValues(uniq(values));
                },
            },
            disables: {
                get() {
                    return this.getDisables();
                },
                set(values) {
                    return this.setDisables(uniq(values));
                },
            },
            selectedNodes: {
                get() {
                    let nodes = [];
                    let nodesById = this.nodesById;
                    for (let id in nodesById) {
                        if (
                            nodesById.hasOwnProperty(id) &&
                            (nodesById[id].status === 1 || nodesById[id].status === 2)
                        ) {
                            let node = Object.assign({}, nodesById[id]);
                            delete node.parent;
                            delete node.children;
                            nodes.push(node);
                        }
                    }
                    return nodes;
                },
            },
            disabledNodes: {
                get() {
                    let nodes = [];
                    let nodesById = this.nodesById;
                    for (let id in nodesById) {
                        if (nodesById.hasOwnProperty(id) && nodesById[id].disabled) {
                            let node = Object.assign({}, nodesById[id]);
                            delete node.parent;
                            nodes.push(node);
                        }
                    }
                    return nodes;
                },
            },
        });

        this.init(this.options.data);
    }

    Tree.prototype.init = function (data) {
        let {
            treeNodes,
            nodesById,
            leafNodesById,
            defaultValues,
            defaultDisables,
        } = Tree.parseTreeData(data);
        this.treeNodes = treeNodes;
        this.nodesById = nodesById;
        this.leafNodesById = leafNodesById;
        this.render(this.treeNodes);
        let {values, disables, loaded} = this.options;
        if (values && values.length) defaultValues = values;
        defaultValues.length && this.setValues(defaultValues);
        if (disables && disables.length) defaultDisables = disables;
        defaultDisables.length && this.setDisables(defaultDisables);
        loaded && loaded.call(this);
    };

    Tree.prototype.render = function (treeNodes) {
        let treeEle = Tree.createRootEle();
        treeEle.appendChild(this.buildTree(treeNodes, 0));
        this.bindEvent(treeEle);
        let ele
        if (typeof this.container === 'string' || this.container instanceof String) {
            ele = document.querySelector(this.container);
        } else {
            ele = this.container;
        }
        empty(ele);
        ele.appendChild(treeEle);
    };

    Tree.prototype.buildTree = function (nodes, depth) {
        let rootUlEle = Tree.createUlEle();
        if (nodes && nodes.length) {
            nodes.forEach(node => {
                let liEle = Tree.createLiEle(
                    node,
                    depth === this.options.closeDepth - 1,
                    !!this.options.load
                );
                this.liElementsById[node.id] = liEle;
                let ulEle = null;
                if (node.children && (node.children.length || !!this.options.load)) {
                    ulEle = this.buildTree(node.children, depth + 1);
                }
                ulEle && liEle.appendChild(ulEle);
                rootUlEle.appendChild(liEle);
            });
        }
        return rootUlEle;
    };

    Tree.prototype.bindEvent = function (ele) {
        ele.addEventListener(
            'click',
            e => {
                let {target} = e;
                if (
                    target.nodeName === 'SPAN' &&
                    (target.classList.contains('treejs-checkbox') ||
                        target.classList.contains('treejs-label'))
                ) {
                    this.onItemClick(target.parentNode.nodeId);
                } else if (
                    target.nodeName === 'LI' &&
                    target.classList.contains('treejs-node')
                ) {
                    this.onItemClick(target.nodeId);
                } else if (
                    target.nodeName === 'SPAN' &&
                    target.classList.contains('treejs-switcher')
                ) {
                    let liEle = target.parentNode;
                    let ele = liEle.lastChild;
                    if (ele.childNodes.length === 0 && this.options.load) {
                        if (!liEle.classList.contains('treejs-node__loading')) {
                            liEle.classList.add('treejs-node__loading')
                        }
                        this.options.load(target.parentNode.nodeId).then((children) => {
                            this.setChildren(target.parentNode.nodeId, children)
                            if (liEle.classList.contains('treejs-node__loading')) {
                                liEle.classList.remove('treejs-node__loading')
                            }
                        });
                    } else {
                        this.onSwitcherClick(target);
                    }
                }
            },
            false
        );
    };

    Tree.prototype.setChildren = function (rootId, children) {
        let children_ = []
        for (let i = 0; i < children.length; i++) {
            if (!this.nodesById[children[i].id]) {
                children_.push(children[i]);
            }
        }
        children = children_
        if (children.length === 0) {
            return;
        }
        let parentNode = this.nodesById[rootId];
        if (!parentNode) return;

        // 1. Calculating nesting depth (for buildTree)
        let depth = 0;
        let temp = parentNode;
        while (temp.parent) {
            depth++;
            temp = temp.parent;
        }

        // 2. Processing new nodes (data linking, status inheritance)
        let self = this;
        let walk = function (nodes, parent) {
            nodes.forEach(node => {
                // Setting a link to the parent
                node.parent = parent;
                // We register in the general registry of nodes
                self.nodesById[node.id] = node;

                // Inheriting the (checked) status from the parent
                // If the parent is selected (2), the children also become selected
                if (parent.status === 2) {
                    node.status = 2;
                } else if (parent.status === 0) {
                    node.status = 0;
                }
                // (If the parent's status is 1 (partial), the child's status is usually 0 by default)

                // Disabled inheritance
                if (parent.disabled) {
                    node.disabled = true;
                }

                // Mark a node to update its visual state (checkboxes)
                self.markWillUpdateNode(node);

                if (node.children && node.children.length) {
                    walk(node.children, node);
                } else {
                    // If there are no children, we register as a single person
                    self.leafNodesById[node.id] = node;
                }
            });
        };

        walk(children, parentNode);
        parentNode.children = children;

        // 3. Create DOM elements for new children
        // buildTree creates a <ul> with all nested <li> elements
        let newUl = this.buildTree(children, depth + 1);

        // 4. Add to the DOM of the parent element
        let parentLi = this.liElementsById[rootId];
        parentLi.appendChild(newUl);

        // 5. Update the visual display of checkboxes and disabled classes
        // (The function uses nodes marked with markWillUpdateNode)
        this.updateLiElements();

        // 6. Expanding the list (animation)
        // Since loading occurs when a user clicks on the switcher, the folder is expected to open.
        // If the folder was closed (treejs-node__close), we simulate a click to open it.
        if (parentLi.classList.contains('treejs-node__close')) {
            let switcher = parentLi.querySelector('.treejs-switcher');
            if (switcher) {
                this.onSwitcherClick(switcher);
            }
        }

        // Fix for inserting a list of child elements
        let removeElems = [];
        for (let i = 0; i < parentLi.childNodes.length; i++) {
            let node = parentLi.childNodes[i];
            if (node.classList.contains("treejs-nodes")) {
                if (node.childNodes.length === 0) {
                    removeElems.push(node);
                } else {
                    let nodes = node.querySelectorAll(".treejs-node");
                    for (let j = 0; j < nodes.length; j++) {
                        if (!nodes[j].classList.contains("treejs-node__close")) {
                            nodes[j].classList.add("treejs-node__close");
                        }
                    }
                }
            }
        }

        for (let i = 0; i < removeElems.length; i++) {
            removeElems[i].remove();
        }

        let {onChange} = this.options;
        onChange && onChange.call(this);
    };

    Tree.prototype.onItemClick = function (id) {
        let node = this.nodesById[id];
        let {onChange} = this.options;
        if (!node.disabled) {
            this.setValue(id);
            this.updateLiElements();
        }
        onChange && onChange.call(this);
    };

    Tree.prototype.setValue = function (value) {
        let node = this.nodesById[value];
        if (!node) return;
        let prevStatus = node.status;
        let status = prevStatus === 1 || prevStatus === 2 ? 0 : 2;
        node.status = status;
        this.markWillUpdateNode(node);
        this.walkUp(node, 'status');
        this.walkDown(node, 'status');
    };

    Tree.prototype.getValues = function () {
        let values = [];
        for (let id in this.leafNodesById) {
            if (this.leafNodesById.hasOwnProperty(id)) {
                if (
                    this.leafNodesById[id].status === 1 ||
                    this.leafNodesById[id].status === 2
                ) {
                    values.push(id);
                }
            }
        }
        return values;
    };

    Tree.prototype.setValues = function (values) {
        this.emptyNodesCheckStatus();
        values.forEach(value => {
            this.setValue(value);
        });
        this.updateLiElements();
        let {onChange} = this.options;
        onChange && onChange.call(this);
    };

    Tree.prototype.setDisable = function (value) {
        let node = this.nodesById[value];
        if (!node) return;
        let prevDisabled = node.disabled;
        if (!prevDisabled) {
            node.disabled = true;
            this.markWillUpdateNode(node);
            this.walkUp(node, 'disabled');
            this.walkDown(node, 'disabled');
        }
    };

    Tree.prototype.getDisables = function () {
        let values = [];
        for (let id in this.leafNodesById) {
            if (this.leafNodesById.hasOwnProperty(id)) {
                if (this.leafNodesById[id].disabled) {
                    values.push(id);
                }
            }
        }
        return values;
    };

    Tree.prototype.setDisables = function (values) {
        this.emptyNodesDisable();
        values.forEach(value => {
            this.setDisable(value);
        });
        this.updateLiElements();
    };

    Tree.prototype.emptyNodesCheckStatus = function () {
        this.willUpdateNodesById = this.getSelectedNodesById();
        Object.values(this.willUpdateNodesById).forEach(node => {
            if (!node.disabled) node.status = 0;
        });
    };

    Tree.prototype.emptyNodesDisable = function () {
        this.willUpdateNodesById = this.getDisabledNodesById();
        Object.values(this.willUpdateNodesById).forEach(node => {
            node.disabled = false;
        });
    };

    Tree.prototype.getSelectedNodesById = function () {
        return Object.entries(this.nodesById).reduce((acc, [id, node]) => {
            if (node.status === 1 || node.status === 2) {
                acc[id] = node;
            }
            return acc;
        }, {});
    };

    Tree.prototype.getDisabledNodesById = function () {
        return Object.entries(this.nodesById).reduce((acc, [id, node]) => {
            if (node.disabled) {
                acc[id] = node;
            }
            return acc;
        }, {});
    };

    Tree.prototype.updateLiElements = function () {
        Object.values(this.willUpdateNodesById).forEach(node => {
            this.updateLiElement(node);
        });
        this.willUpdateNodesById = {};
    };

    Tree.prototype.markWillUpdateNode = function (node) {
        this.willUpdateNodesById[node.id] = node;
    };

    Tree.prototype.onSwitcherClick = function (target) {
        let liEle = target.parentNode;
        let ele = liEle.lastChild;
        let height = ele.scrollHeight;
        if (liEle.classList.contains('treejs-node__close')) {
            animation(150, {
                enter() {
                    ele.style.height = 0;
                    ele.style.opacity = 0;
                },
                active() {
                    ele.style.height = `${height}px`;
                    ele.style.opacity = 1;
                },
                leave() {
                    ele.style.height = '';
                    ele.style.opacity = '';
                    liEle.classList.remove('treejs-node__close');
                },
            });
        } else {
            animation(150, {
                enter() {
                    ele.style.height = `${height}px`;
                    ele.style.opacity = 1;
                },
                active() {
                    ele.style.height = 0;
                    ele.style.opacity = 0;
                },
                leave() {
                    ele.style.height = '';
                    ele.style.opacity = '';
                    liEle.classList.add('treejs-node__close');
                },
            });
        }
    };

    Tree.prototype.walkUp = function (node, changeState) {
        let {parent} = node;
        if (parent) {
            if (changeState === 'status') {
                let pStatus = null;
                let statusCount = parent.children.reduce((acc, child) => {
                    if (!isNaN(child.status)) return acc + child.status;
                    return acc;
                }, 0);
                if (statusCount) {
                    pStatus = statusCount === parent.children.length * 2 ? 2 : 1;
                } else {
                    pStatus = 0;
                }
                if (parent.status === pStatus) return;
                parent.status = pStatus;
            } else {
                let pDisabled = parent.children.reduce(
                    (acc, child) => acc && child.disabled,
                    true
                );
                if (parent.disabled === pDisabled) return;
                parent.disabled = pDisabled;
            }
            this.markWillUpdateNode(parent);
            this.walkUp(parent, changeState);
        }
    };

    Tree.prototype.walkDown = function (node, changeState) {
        if (node.children && node.children.length) {
            node.children.forEach(child => {
                if (changeState === 'status' && child.disabled) return;
                child[changeState] = node[changeState];
                this.markWillUpdateNode(child);
                this.walkDown(child, changeState);
            });
        }
    };

    Tree.prototype.updateLiElement = function (node) {
        let {classList} = this.liElementsById[node.id];
        switch (node.status) {
            case 0:
                classList.remove('treejs-node__halfchecked', 'treejs-node__checked');
                break;
            case 1:
                classList.remove('treejs-node__checked');
                classList.add('treejs-node__halfchecked');
                break;
            case 2:
                classList.remove('treejs-node__halfchecked');
                classList.add('treejs-node__checked');
                break;
        }

        switch (node.disabled) {
            case true:
                if (!classList.contains('treejs-node__disabled'))
                    classList.add('treejs-node__disabled');
                break;
            case false:
                if (classList.contains('treejs-node__disabled'))
                    classList.remove('treejs-node__disabled');
                break;
        }
    };

    Tree.prototype.collapseAll = function () {
        let leafNodesById = this.leafNodesById;
        for (let id in leafNodesById) {
            let leafNode = leafNodesById[id];
            collapseFromLeaf(this, leafNode);
        }
    }

    Tree.prototype.expandAll = function () {
        expandFromRoot(this, this.treeNodes[0]);
    }

    Tree.parseTreeData = function (data) {
        let treeNodes = deepClone(data);
        let nodesById = {};
        let leafNodesById = {};
        let values = [];
        let disables = [];
        let walkTree = function (nodes, parent) {
            nodes.forEach(node => {
                nodesById[node.id] = node;
                if (node.checked) values.push(node.id);
                if (node.disabled) disables.push(node.id);
                if (parent) node.parent = parent;
                if (node.children && node.children.length) {
                    walkTree(node.children, node);
                } else {
                    leafNodesById[node.id] = node;
                }
            });
        };
        walkTree(treeNodes);
        return {
            treeNodes,
            nodesById,
            leafNodesById,
            defaultValues: values,
            defaultDisables: disables,
        };
    };

    Tree.createRootEle = function () {
        let div = document.createElement('div');
        div.classList.add('treejs');
        return div;
    };

    Tree.createUlEle = function () {
        let ul = document.createElement('ul');
        ul.classList.add('treejs-nodes');
        return ul;
    };

    Tree.createLiEle = function (node, closed, isLoadExists) {
        let li = document.createElement('li');
        li.classList.add('treejs-node');
        if (closed) li.classList.add('treejs-node__close');
        if (node.children && (node.children.length || isLoadExists)) {
            let switcher = document.createElement('span');
            switcher.classList.add('treejs-switcher');
            li.appendChild(switcher);
        } else {
            li.classList.add('treejs-placeholder');
        }
        let checkbox = document.createElement('span');
        checkbox.classList.add('treejs-checkbox');
        li.appendChild(checkbox);
        let label = document.createElement('span');
        label.classList.add('treejs-label');
        let text = document.createTextNode(node.text);
        label.appendChild(text);
        li.appendChild(label);
        li.nodeId = node.id;
        return li;
    };
    window.Tree = Tree;
})();