#include <emscripten/emscripten.h>
#include "Graph.h"

// This pointer will hold the memory address where we put results for JS to read
int *outputBuffer = nullptr;
Graph *globalGraph = nullptr;

extern "C"
{

    EMSCRIPTEN_KEEPALIVE
    void initGraph(int vertices)
    {
        if (globalGraph)
            delete globalGraph;
        globalGraph = new Graph(vertices);

        // Re-allocate buffer for results
        if (outputBuffer)
            delete[] outputBuffer;
        outputBuffer = new int[vertices];
    }

    EMSCRIPTEN_KEEPALIVE
    void addEdge(int u, int v, int w)
    {
        if (globalGraph)
        {
            globalGraph->addEdge(u, v, w);
        }
    }

    EMSCRIPTEN_KEEPALIVE
    int *getResultBuffer()
    {
        return outputBuffer;
    }

    EMSCRIPTEN_KEEPALIVE
    void runBFS(int startNode)
    {
        if (globalGraph)
            globalGraph->BFS(startNode, outputBuffer);
    }

    EMSCRIPTEN_KEEPALIVE
    void runDFS(int startNode)
    {
        if (globalGraph)
            globalGraph->DFS(startNode, outputBuffer);
    }

    EMSCRIPTEN_KEEPALIVE
    void runPrims(int startNode)
    {
        if (globalGraph)
            globalGraph->PrimsAlgorithm(startNode, outputBuffer);
    }

    EMSCRIPTEN_KEEPALIVE
    void runDijkstra(int startNode)
    {
        if (globalGraph)
            globalGraph->DijkstraAlgorithm(startNode, outputBuffer);
    }
}

int main()
{
    // Main is empty, we are event-driven!
    return 0;
}