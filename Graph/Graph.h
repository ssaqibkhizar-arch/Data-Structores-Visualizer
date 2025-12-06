#ifndef GRAPH_H
#define GRAPH_H

#include <iostream>
#include <climits>
using namespace std;

template <typename T>
struct SNode
{
    T data;
    SNode<T> *next;

    SNode(T value)
    {
        data = value;
        next = nullptr;
    }
};

template <typename T>
class Stack
{
    SNode<T> *front;

public:
    Stack()
    {
        front = nullptr;
    }

    ~Stack()
    {
        SNode<T> *currNode = front;
        while (currNode)
        {
            SNode<T> *nextNode = currNode->next;
            delete currNode;
            currNode = nextNode;
        }
        front = nullptr;
    }

    void push(T v)
    {
        SNode<T> *newNode = new SNode<T>(v);
        if (!front)
        {
            front = newNode;
            return;
        }
        newNode->next = front;
        front = newNode;
    }

    void pop()
    {
        if (!front)
            return;
        SNode<T> *tempNode = front;
        front = front->next;
        delete tempNode;
    }

    T top()
    {
        if (front)
            return front->data;
        return T();
    }

    bool isEmpty()
    {
        if (!front)
            return true;
        return false;
    }
};

template <typename T>
struct QNode
{
    T data;
    QNode<T> *next;

    QNode(T value)
    {
        data = value;
        next = nullptr;
    }
};

template <typename T>
class Queue
{
    QNode<T> *front;
    QNode<T> *rear;

public:
    Queue()
    {
        front = rear = nullptr;
    }

    ~Queue()
    {
        QNode<T> *currNode = front;
        while (currNode)
        {
            QNode<T> *nextNode = currNode->next;
            delete currNode;
            currNode = nextNode;
        }
        front = rear = nullptr;
    }

    void enqueue(T v)
    {
        QNode<T> *newNode = new QNode<T>(v);
        if (!rear)
        {
            front = rear = newNode;
            return;
        }
        rear->next = newNode;
        rear = newNode;
    }

    void dequeue()
    {
        if (!front)
            return;
        QNode<T> *tempNode = front;
        front = front->next;
        if (!front)
            rear = nullptr;
        delete tempNode;
    }

    T getFront()
    {
        if (front)
            return front->data;
        return T();
    }

    bool isEmpty()
    {
        return front == nullptr;
    }
};

template <typename T>
struct Node
{
    T destination;
    T weight;
    Node<T> *next;

    Node(T dest, T w)
    {
        destination = dest;
        weight = w;
        next = nullptr;
    }
};

template <typename T>
class AdjList
{
    Node<T> *front;
    Node<T> *rear;

public:
    AdjList()
    {
        front = rear = nullptr;
    }

    ~AdjList()
    {
        Node<T> *currNode = front;
        while (currNode)
        {
            Node<T> *tempNode = currNode->next;
            delete currNode;
            currNode = tempNode;
        }
        front = rear = nullptr;
    }

    void AddEdge(T dest, T w)
    {
        Node<T> *newNode = new Node<T>(dest, w);
        if (!front)
        {
            front = rear = newNode;
            return;
        }
        newNode->next = front;
        front = newNode;
    }

    Node<T> *getHead()
    {
        return front;
    }
};

template <typename T>
struct HNode
{
    T vertex;
    T key;

    HNode(T v = T(), T k = T())
    {
        vertex = v;
        key = k;
    }
};

template <typename T>
class Heap
{
private:
    HNode<T> *arr;
    int size;
    int capacity;

    void percolateDown(int i)
    {
        int left = 2 * i;
        int right = 2 * i + 1;
        int smallest = i;

        if (left <= size && arr[left].key < arr[smallest].key)
            smallest = left;

        if (right <= size && arr[right].key < arr[smallest].key)
            smallest = right;

        if (smallest != i)
        {
            HNode<T> temp = arr[i];
            arr[i] = arr[smallest];
            arr[smallest] = temp;
            percolateDown(smallest);
        }
    }

    void percolateUp(int i)
    {
        int parent = i / 2;
        while (i > 1 && arr[i].key < arr[parent].key)
        {
            HNode<T> temp = arr[i];
            arr[i] = arr[parent];
            arr[parent] = temp;
            i = parent;
            parent = i / 2;
        }
    }

public:
    Heap(int cap)
    {
        capacity = cap;
        size = 0;
        arr = new HNode<T>[capacity + 1];
    }

    ~Heap()
    {
        delete[] arr;
    }

    bool isEmpty()
    {
        return size == 0;
    }

    void InsertKey(T v, T k)
    {
        if (size >= capacity)
            return;
        size++;
        arr[size] = HNode<T>(v, k);
        percolateUp(size);
    }

    HNode<T> ExtractMin()
    {
        if (size == 0)
            return HNode<T>();
        HNode<T> minNode = arr[1];
        arr[1] = arr[size];
        size--;
        percolateDown(1);
        return minNode;
    }
};

class Graph
{
    int vertices;
    AdjList<int> *array;
    int **AdjMat;

public:
    Graph(int v)
    {
        vertices = v;
        array = new AdjList<int>[v];
        AdjMat = new int *[v];

        for (int i = 0; i < v; i++)
        {
            AdjMat[i] = new int[v];
            for (int j = 0; j < v; j++)
            {
                AdjMat[i][j] = 0;
            }
        }
    }

    ~Graph()
    {
        delete[] array;
        for (int i = 0; i < vertices; i++)
        {
            delete[] AdjMat[i];
        }
        delete[] AdjMat;
    }

    void addEdge(int src, int dest, int w)
    {
        if (src >= 0 && src < vertices && dest >= 0 && dest < vertices)
        {
            array[src].AddEdge(dest, w);
            array[dest].AddEdge(src, w);
            AdjMat[src][dest] = w;
            AdjMat[dest][src] = w;
        }
    }

    // BFS - Fills buffer with traversal order
    void BFS(int startIndex, int *buffer)
    {
        bool *visited = new bool[vertices];
        for (int i = 0; i < vertices; i++)
            visited[i] = false;

        Queue<int> q;
        visited[startIndex] = true;
        q.enqueue(startIndex);

        int count = 0;

        while (!q.isEmpty())
        {
            int currVertex = q.getFront();
            buffer[count++] = currVertex;
            q.dequeue();

            Node<int> *temp = array[currVertex].getHead();
            while (temp)
            {
                int adjVertex = temp->destination;
                if (!visited[adjVertex])
                {
                    visited[adjVertex] = true;
                    q.enqueue(adjVertex);
                }
                temp = temp->next;
            }
        }
        delete[] visited;
    }

    void DFS(int startIndex, int *buffer)
    {
        bool *visited = new bool[vertices];
        for (int i = 0; i < vertices; i++)
            visited[i] = false;

        Stack<int> s;
        s.push(startIndex);

        int count = 0;

        while (!s.isEmpty())
        {
            int currVertex = s.top();
            s.pop();

            if (!visited[currVertex])
            {
                buffer[count++] = currVertex;
                visited[currVertex] = true;
            }

            Node<int> *temp = array[currVertex].getHead();
            while (temp)
            {
                int AdjVertex = temp->destination;
                if (!visited[AdjVertex])
                {
                    s.push(AdjVertex);
                }
                temp = temp->next;
            }
        }
        delete[] visited;
    }

    void PrimsAlgorithm(int startIndex, int *parentBuffer)
    {
        Heap<int> h(vertices * vertices);
        int *key = new int[vertices];
        bool *visited = new bool[vertices];

        for (int i = 0; i < vertices; i++)
        {
            key[i] = INT_MAX;
            visited[i] = false;
            parentBuffer[i] = -1;
        }

        key[startIndex] = 0;
        h.InsertKey(startIndex, 0);

        while (!h.isEmpty())
        {
            HNode<int> minNode = h.ExtractMin();
            int u = minNode.vertex;

            if (visited[u])
                continue;
            visited[u] = true;

            Node<int> *temp = array[u].getHead();
            while (temp)
            {
                int v = temp->destination;
                int weight = temp->weight;
                if (!visited[v] && weight < key[v])
                {
                    key[v] = weight;
                    parentBuffer[v] = u;
                    h.InsertKey(v, key[v]);
                }
                temp = temp->next;
            }
        }
        delete[] key;
        delete[] visited;
    }

    void DijkstraAlgorithm(int startIndex, int *distBuffer)
    {
        Heap<int> h(vertices * vertices);

        for (int i = 0; i < vertices; i++)
            distBuffer[i] = INT_MAX;

        distBuffer[startIndex] = 0;
        h.InsertKey(startIndex, 0);

        while (!h.isEmpty())
        {
            HNode<int> minNode = h.ExtractMin();
            int u = minNode.vertex;
            int d = minNode.key;

            if (d > distBuffer[u])
                continue;

            Node<int> *temp = array[u].getHead();
            while (temp)
            {
                int v = temp->destination;
                int weight = temp->weight;
                if (distBuffer[u] != INT_MAX && distBuffer[u] + weight < distBuffer[v])
                {
                    distBuffer[v] = distBuffer[u] + weight;
                    h.InsertKey(v, distBuffer[v]);
                }
                temp = temp->next;
            }
        }
    }
};

#endif