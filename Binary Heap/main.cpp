#include <iostream>
#include <string>
#include <sstream>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

using namespace std;

class Heap
{
    int *arr;
    int capacity;
    int size;

    // Helper to swap nodes
    void swap(int &a, int &b)
    {
        int temp = a;
        a = b;
        b = temp;
    }

    void percolateUPMin(int i)
    {
        if (i <= 1)
            return; // Root logic for 1-based indexing
        int parent = i / 2;
        if (arr[parent] > arr[i])
        {
            swap(arr[parent], arr[i]);
            percolateUPMin(parent);
        }
    }

    void percolateUPMax(int i)
    {
        if (i <= 1)
            return;
        int parent = i / 2;
        if (arr[parent] < arr[i])
        {
            swap(arr[parent], arr[i]);
            percolateUPMax(parent);
        }
    }

    void percolateDownMin(int i)
    {
        int left = 2 * i;
        int right = (2 * i) + 1;
        int smallest = i;

        if (left <= size && arr[left] < arr[smallest])
            smallest = left;
        if (right <= size && arr[right] < arr[smallest])
            smallest = right;

        if (smallest != i)
        {
            swap(arr[i], arr[smallest]);
            percolateDownMin(smallest);
        }
    }

    void percolateDownMax(int i)
    {
        int left = 2 * i;
        int right = (2 * i) + 1;
        int largest = i;

        if (left <= size && arr[left] > arr[largest])
            largest = left;
        if (right <= size && arr[right] > arr[largest])
            largest = right;

        if (largest != i)
        {
            swap(arr[i], arr[largest]);
            // FIX: Was recursively calling Min, changed to Max
            percolateDownMax(largest);
        }
    }

    // Helper for JSON: Converts index to recursive tree JSON
    void nodeToJSON(int i, stringstream &ss)
    {
        if (i > size)
        {
            ss << "null";
            return;
        }

        ss << "{";
        ss << "\"value\": " << arr[i] << ",";
        ss << "\"index\": " << i << ","; // Useful for array visualization
        ss << "\"children\": [";

        // Left Child
        nodeToJSON(2 * i, ss);
        ss << ",";
        // Right Child
        nodeToJSON(2 * i + 1, ss);

        ss << "]}";
    }

public:
    Heap(int s)
    {
        capacity = s + 1; // 1-based indexing
        // FIX: 'new int[capacity]' for array, not 'new int(capacity)'
        arr = new int[capacity];
        size = 0;
    }

    ~Heap()
    {
        delete[] arr;
    }

    void insertMin(int val)
    {
        if (size >= capacity - 1)
            return; // Full
        size++;
        arr[size] = val;
        percolateUPMin(size);
    }

    void insertMax(int val)
    {
        if (size >= capacity - 1)
            return; // Full
        size++;
        arr[size] = val;
        percolateUPMax(size);
    }

    // FIX: Completed logic
    int extractMin()
    {
        if (size == 0)
            return -1;
        int root = arr[1];
        arr[1] = arr[size];
        size--;
        percolateDownMin(1);
        return root;
    }

    // Added Extract Max
    int extractMax()
    {
        if (size == 0)
            return -1;
        int root = arr[1];
        arr[1] = arr[size];
        size--;
        percolateDownMax(1);
        return root;
    }

    // Returns the Tree Structure JSON for D3
    string getTreeJSON()
    {
        if (size == 0)
            return "null";
        stringstream ss;
        nodeToJSON(1, ss);
        return ss.str();
    }

    // Returns the flat Array JSON for the Array View
    string getArrayJSON()
    {
        stringstream ss;
        ss << "[";
        for (int i = 1; i <= size; i++)
        {
            ss << arr[i];
            if (i < size)
                ss << ",";
        }
        ss << "]";
        return ss.str();
    }

    // Convert current heap to Min or Max (Heapify All)
    void rebuild(bool isMin)
    {
        // Floyd's building algorithm: start from last parent down to root
        for (int i = size / 2; i >= 1; i--)
        {
            if (isMin)
                percolateDownMin(i);
            else
                percolateDownMax(i);
        }
    }

    void clear() { size = 0; }
};

// --- Web Interface ---

Heap *heap = nullptr;
string buffer;
bool isMinMode = true; // Toggle state

extern "C"
{
    EMSCRIPTEN_KEEPALIVE
    void initHeap()
    {
        if (heap)
            delete heap;
        // Initialize with capacity 100
        heap = new Heap(100);
        isMinMode = true;
    }

    EMSCRIPTEN_KEEPALIVE
    void toggleMode(int isMin)
    {
        isMinMode = (isMin == 1);
        if (heap)
            heap->rebuild(isMinMode);
    }

    EMSCRIPTEN_KEEPALIVE
    const char *insertNode(int val)
    {
        if (!heap)
            initHeap();

        if (isMinMode)
            heap->insertMin(val);
        else
            heap->insertMax(val);

        buffer = heap->getTreeJSON();
        return buffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    const char *deleteNode(int val)
    {
        // Note: Heaps usually only extract root (Min/Max).
        // We will treat "deleteNode" as "Extract Root" regardless of the 'val' passed.
        if (!heap)
            return "null";

        if (isMinMode)
            heap->extractMin();
        else
            heap->extractMax();

        buffer = heap->getTreeJSON();
        return buffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    const char *getHeapJSON()
    {
        if (!heap)
            return "null";
        buffer = heap->getTreeJSON();
        return buffer.c_str();
    }

    // New: Get the flat array for visualization
    EMSCRIPTEN_KEEPALIVE
    const char *getArrayData()
    {
        if (!heap)
            return "[]";
        buffer = heap->getArrayJSON();
        return buffer.c_str();
    }
}

int main() { return 0; }