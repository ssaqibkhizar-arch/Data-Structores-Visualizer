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

// Represents a single slot in the Hash Table
struct Entry
{
    int value;
    bool occupied; // false = empty, true = occupied
    Entry* next;   // For Separate Chaining

    Entry()
    {
        value = -1;
        occupied = false;
        next = nullptr;
    }
};

class HashTable
{
private:
    Entry* table;
    int capacity;
    int size;

public:
    HashTable(int cap)
    {
        capacity = cap;
        size = 0;
        table = new Entry[capacity];
    }

    ~HashTable()
    {
        clear();
        delete[] table;
    }

    // Helper to format a step for the frontend animation log
    // Format: "index:status" (e.g., "4:collision")
    string formatStep(int index, string status, int val) {
        stringstream ss;
        ss << "{\"index\":" << index << ",\"status\":\"" << status << "\",\"val\":" << val << "}";
        return ss.str();
    }

    // Returns a JSON string describing the steps taken during insertion
    // probeType: 1 = Linear, 2 = Quadratic, 3 = Chaining
    string insert(int value, int probeType)
    {
        stringstream logStream;
        logStream << "["; 

        int initialIndex = value % capacity;
        bool inserted = false;

        // --- Separate Chaining Logic ---
        if (probeType == 3) 
        {
            // 1. Check Head
            if (!table[initialIndex].occupied) {
                table[initialIndex].value = value;
                table[initialIndex].occupied = true;
                table[initialIndex].next = nullptr;
                size++;
                logStream << formatStep(initialIndex, "inserted", value);
            } else {
                // Collision at head, traverse chain
                logStream << formatStep(initialIndex, "collision", table[initialIndex].value) << ",";
                
                Entry* curr = &table[initialIndex];
                bool duplicate = false;

                // Check head duplicate
                if (curr->value == value) duplicate = true;

                // Traverse list
                while (curr->next != nullptr && !duplicate) {
                    curr = curr->next;
                    logStream << formatStep(initialIndex, "traversing", curr->value) << ","; // Index remains bucket index for visuals
                    if (curr->value == value) duplicate = true;
                }

                if (duplicate) {
                    logStream << formatStep(initialIndex, "duplicate", value);
                } else {
                    // Append new node
                    curr->next = new Entry();
                    curr->next->value = value;
                    curr->next->occupied = true;
                    curr->next->next = nullptr;
                    size++;
                    logStream << formatStep(initialIndex, "inserted_chain", value);
                }
            }
            logStream << "]";
            return logStream.str();
        }

        // --- Open Addressing Logic (Linear/Quadratic) ---
        for (int i = 0; i < capacity; i++)
        {
            int currentIndex;

            if (probeType == 1) {
                // Linear Probing: (H(x) + i) % Size
                currentIndex = (initialIndex + i) % capacity;
            } else {
                // Quadratic Probing: (H(x) + i*i) % Size
                currentIndex = (initialIndex + (i * i)) % capacity;
            }

            if (i > 0) logStream << ",";

            // 1. Check for Duplicate
            if (table[currentIndex].occupied && table[currentIndex].value == value)
            {
                logStream << formatStep(currentIndex, "duplicate", value);
                inserted = true;
                break;
            }

            // 2. Check if Empty (Insertion Point)
            if (!table[currentIndex].occupied)
            {
                table[currentIndex].value = value;
                table[currentIndex].occupied = true;
                size++;
                
                logStream << formatStep(currentIndex, "inserted", value);
                inserted = true;
                break;
            }

            // 3. Collision
            logStream << formatStep(currentIndex, "collision", table[currentIndex].value);
        }

        if (!inserted) {
            logStream << ",{\"index\":-1,\"status\":\"full\",\"val\":" << value << "}";
        }

        logStream << "]";
        return logStream.str();
    }

    // Search function returning JSON log of search path
    string search(int value, int probeType) {
        stringstream logStream;
        logStream << "[";
        
        int initialIndex = value % capacity;
        bool found = false;

        // --- Separate Chaining Search ---
        if (probeType == 3) {
             if (!table[initialIndex].occupied) {
                 logStream << formatStep(initialIndex, "empty", -1);
             } else {
                 Entry* curr = &table[initialIndex];
                 while(curr != nullptr) {
                     if (curr != &table[initialIndex]) logStream << ",";
                     
                     if (curr->value == value) {
                         logStream << formatStep(initialIndex, "found", value);
                         found = true;
                         break;
                     }
                     logStream << formatStep(initialIndex, "traversing", curr->value);
                     curr = curr->next;
                 }
                 if (!found) logStream << "," << formatStep(initialIndex, "not_found", -1);
             }
             logStream << "]";
             return logStream.str();
        }

        // --- Open Addressing Search ---
        for (int i = 0; i < capacity; i++)
        {
            int currentIndex;
            if (probeType == 1) currentIndex = (initialIndex + i) % capacity;
            else currentIndex = (initialIndex + (i * i)) % capacity;

            if (i > 0) logStream << ",";

            // If we hit an empty spot, item doesn't exist
            if (!table[currentIndex].occupied) {
                logStream << formatStep(currentIndex, "empty", -1);
                break; 
            }

            if (table[currentIndex].occupied && table[currentIndex].value == value) {
                logStream << formatStep(currentIndex, "found", value);
                found = true;
                break;
            }

            logStream << formatStep(currentIndex, "collision", table[currentIndex].value);
        }

        logStream << "]";
        return logStream.str();
    }

    // Returns the full state of the table for rendering
    string getTableJSON()
    {
        stringstream ss;
        ss << "[";
        for (int i = 0; i < capacity; i++)
        {
            ss << "{";
            ss << "\"index\":" << i << ",";
            ss << "\"occupied\":" << (table[i].occupied ? "true" : "false");
            if (table[i].occupied) {
                ss << ",\"value\":" << table[i].value;
            } else {
                ss << ",\"value\":null";
            }
            
            // Serialize Chain
            ss << ",\"chain\":[";
            Entry* curr = table[i].next;
            while(curr) {
                ss << curr->value;
                curr = curr->next;
                if(curr) ss << ",";
            }
            ss << "]";

            ss << "}";
            if (i < capacity - 1) ss << ",";
        }
        ss << "]";
        return ss.str();
    }
    
    void clear() {
        for(int i=0; i<capacity; i++) {
            // Delete chain nodes
            Entry* curr = table[i].next;
            while (curr != nullptr) {
                Entry* temp = curr;
                curr = curr->next;
                delete temp;
            }
            table[i].next = nullptr;
            table[i].occupied = false;
            table[i].value = -1;
        }
        size = 0;
    }
};

// --- GLOBAL INTERFACE ---
HashTable* globalTable = nullptr;
std::string responseBuffer;

extern "C" {
    
    EMSCRIPTEN_KEEPALIVE
    void initHashTable(int capacity) {
        if (globalTable) delete globalTable;
        globalTable = new HashTable(capacity);
    }

    // Returns a JSON Log of the steps taken: e.g. [{index:2, status:"collision"}, {index:3, status:"inserted"}]
    // probeType: 1=Linear, 2=Quadratic, 3=Chaining
    EMSCRIPTEN_KEEPALIVE
    const char* insertValue(int val, int probeType) {
        if (!globalTable) initHashTable(12); // Default size 12 if not init
        responseBuffer = globalTable->insert(val, probeType);
        return responseBuffer.c_str();
    }

    EMSCRIPTEN_KEEPALIVE
    const char* searchValue(int val, int probeType) {
        if (!globalTable) return "[]";
        responseBuffer = globalTable->search(val, probeType);
        return responseBuffer.c_str();
    }

    // Returns the static view of the table including chains
    EMSCRIPTEN_KEEPALIVE
    const char* getTableJSON() {
        if (!globalTable) return "[]";
        responseBuffer = globalTable->getTableJSON();
        return responseBuffer.c_str();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void resetTable() {
        if (globalTable) globalTable->clear();
    }
}

int main() {
    return 0;
}