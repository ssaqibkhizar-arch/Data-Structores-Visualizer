#include <iostream>
#include <algorithm>
#include <string>
#include <sstream>
#include<queue>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

using namespace std;

// --- AVL Logic ---

struct Node 
{
    int key;
    Node* left;
    Node* right;
    int height;
    Node(int k) : key(k), left(nullptr), right(nullptr), height(1) {}
};

class AVLTree 
{
    Node* root;

    int height(Node* N) { return N ? N->height : 0; }
    int max(int a, int b) { return (a > b) ? a : b; }

    Node* rightRotate(Node* y) 
    {
        Node* x = y->left;
        Node* T2 = x->right;
        x->right = y;
        y->left = T2;
        y->height = max(height(y->left), height(y->right)) + 1;
        x->height = max(height(x->left), height(x->right)) + 1;
        return x;
    }

    Node* leftRotate(Node* x) 
    {
        Node* y = x->right;
        Node* T2 = y->left;
        y->left = x;
        x->right = T2;
        x->height = max(height(x->left), height(x->right)) + 1;
        y->height = max(height(y->left), height(y->right)) + 1;
        return y;
    }

    int getBalance(Node* N) { return N ? height(N->left) - height(N->right) : 0; }

    Node* insert(Node* node, int key) 
    {
        if (!node) return new Node(key);
        if (key < node->key) node->left = insert(node->left, key);
        else if (key > node->key) node->right = insert(node->right, key);
        else return node;

        node->height = 1 + max(height(node->left), height(node->right));
        int balance = getBalance(node);

        if (balance > 1 && key < node->left->key) return rightRotate(node);
        if (balance < -1 && key > node->right->key) return leftRotate(node);
        if (balance > 1 && key > node->left->key) 
        {
            node->left = leftRotate(node->left);
            return rightRotate(node);
        }
        if (balance < -1 && key < node->right->key) 
        {
            node->right = rightRotate(node->right);
            return leftRotate(node);
        }
        return node;
    }

    Node* minValueNode(Node* node) 
    {
        Node* current = node;
        while (current->left != nullptr) current = current->left;
        return current;
    }

    Node* deleteNode(Node* root, int key) 
    {
        if (!root) return root;
        if (key < root->key) root->left = deleteNode(root->left, key);
        else if (key > root->key) root->right = deleteNode(root->right, key);
        else 
        {
            if (!root->left || !root->right) 
            {
                Node* temp = root->left ? root->left : root->right;
                if (!temp) { temp = root; root = nullptr; }
                else *root = *temp;
                delete temp;
            } else 
            {
                Node* temp = minValueNode(root->right);
                root->key = temp->key;
                root->right = deleteNode(root->right, temp->key);
            }
        }
        if (!root) return root;

        root->height = 1 + max(height(root->left), height(root->right));
        int balance = getBalance(root);

        if (balance > 1 && getBalance(root->left) >= 0) return rightRotate(root);
        if (balance > 1 && getBalance(root->left) < 0) 
        {
            root->left = leftRotate(root->left);
            return rightRotate(root);
        }
        if (balance < -1 && getBalance(root->right) <= 0) return leftRotate(root);
        if (balance < -1 && getBalance(root->right) > 0) 
        {
            root->right = rightRotate(root->right);
            return leftRotate(root);
        }
        return root;
    }

    bool search(Node* root, int key) 
    {
        if (!root) return false;
        if (root->key == key) return true;
        if (key < root->key) return search(root->left, key);
        return search(root->right, key);
    }

    void toJSON(Node* root, stringstream& ss) 
    {
        if (!root) { ss << "null"; return; }
        ss << "{"
           << "\"value\":" << root->key << ","
           << "\"height\":" << root->height << ","
           << "\"children\":["; // D3 prefers 'children' array
        
        // Always output two children for binary tree structure
        toJSON(root->left, ss);
        ss << ",";
        toJSON(root->right, ss);
        
        ss << "]}";
    }

    // Traversals
    void preOrder(Node* root, stringstream& ss)
    {
        if (!root) return;
        ss << root->key << " ";
        preOrder(root->left, ss);
        preOrder(root->right, ss);
    }
    void inOrder(Node* root, stringstream& ss) 
    {
        if (!root) return;
        inOrder(root->left, ss);
        ss << root->key << " ";
        inOrder(root->right, ss);
    }
    void postOrder(Node* root, stringstream& ss) 
    {
        if (!root) return;
        postOrder(root->left, ss);
        postOrder(root->right, ss);
        ss << root->key << " ";
    }

    void levelOrder(Node* root, stringstream& ss) 
    {
        if (!root) return;
        std::queue<Node*> q;
        q.push(root);
        while (!q.empty()) 
        {
            Node* current = q.front();
            q.pop();
            ss << current->key << " ";
            if (current->left) q.push(current->left);
            if (current->right) q.push(current->right);
        }
    }
    
    void deleteTree(Node* node) 
    {
        if (!node) return;
        deleteTree(node->left);
        deleteTree(node->right);
        delete node;
    }

public:
    AVLTree() : root(nullptr) {}
    ~AVLTree() { deleteTree(root); }
    void insertKey(int key) { root = insert(root, key); }
    void removeKey(int key) { root = deleteNode(root, key); }
    bool searchKey(int key) { return search(root, key); }
    
    string getJSON() 
    {
        stringstream ss;
        toJSON(root, ss);
        return ss.str();
    }
    string getTraversal(int type) 
    {
        stringstream ss;
        if (type == 0) preOrder(root, ss);
        else if (type == 1) inOrder(root, ss);
        else if (type == 2) postOrder(root, ss);
        else if (type == 3) levelOrder(root, ss); 
        return ss.str();
    }
};

// --- Web Interface ---

AVLTree* tree = nullptr;
string buffer;

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void initTree() 
    {
        if (tree) delete tree;
        tree = new AVLTree();
    }

    EMSCRIPTEN_KEEPALIVE
    const char* insertNode(int val) 
    {
        if (!tree) initTree();
        tree->insertKey(val);
        buffer = tree->getJSON();
        return buffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    const char* deleteNode(int val) 
    {
        if (!tree) initTree();
        tree->removeKey(val);
        buffer = tree->getJSON();
        return buffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    int searchNode(int val) 
    {
        if (!tree) return 0;
        return tree->searchKey(val) ? 1 : 0;
    }

    EMSCRIPTEN_KEEPALIVE
    const char* getTreeJSON() 
    {
        if (!tree) return "null";
        buffer = tree->getJSON();
        return buffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    const char* getTraversal(int type) 
    {
        if (!tree) return "";
        buffer = tree->getTraversal(type);
        return buffer.c_str();
    }
}

int main()
{ return 0; }