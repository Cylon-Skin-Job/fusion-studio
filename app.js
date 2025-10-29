// Fusion Studio - JSON File Loader

// State management
let currentFile = null;
let currentPrompt = null;
let chatHistory = [];
let activeChatSlot = null;
let contextMenuTargetSlot = null;
let userBubbleMenuTargetIndex = null;
let promptUpdateTimeout = null;
let modelList = [];
let selectedModel = null;
let fileLibrary = []; // Stores all loaded files with metadata
let lastActiveTab = 'readme'; // Track last active tab

// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const addJsonButton = document.getElementById('addJsonButton');
const activeFileDisplay = document.getElementById('activeFile');
const promptInput = document.getElementById('promptInput');
const addPromptButton = document.getElementById('addPromptButton');
const promptText = document.getElementById('promptText');
const activeChatName = document.getElementById('activeChatName');
const chatMessages = document.getElementById('chatMessages');
const contextMenu = document.getElementById('contextMenu');
const renameOption = document.getElementById('renameOption');
const exportOption = document.getElementById('exportOption');
const clearDataOption = document.getElementById('clearDataOption');
const userBubbleMenu = document.getElementById('userBubbleMenu');
const regenerateOption = document.getElementById('regenerateOption');
const deleteOption = document.getElementById('deleteOption');
const editOption = document.getElementById('editOption');
const clearAllButton = document.getElementById('clearAllButton');
const viewPromptButton = document.getElementById('viewPromptButton');
const viewFilesButton = document.getElementById('viewFilesButton');
const filesModal = document.getElementById('filesModal');
const fileViewerPane = document.getElementById('fileViewerPane');
const fileViewerTitle = document.getElementById('fileViewerTitle');
const fileViewerContent = document.getElementById('fileViewerContent');
const viewReadmeButton = document.getElementById('viewReadmeButton');
const readmeModal = document.getElementById('readmeModal');
const modelSelect = document.getElementById('modelSelect');
// const chatNameDisplay = document.getElementById('chatNameDisplay'); // Removed - redundant display
const sendButton = document.getElementById('sendButton');
const messageInput = document.getElementById('messageInput');
const apiKeyButton = document.getElementById('apiKeyButton');
const stackIcon = document.querySelector('.stack-icon');

// Initialize the app
function init() {
    // Initialize chat history and models
    initChatHistory();
    initModelList();
    initFileLibrary();
    
    // Set up event listeners
    addJsonButton.addEventListener('click', handleAddJsonClick);
    fileInput.addEventListener('change', handleFileSelect);
    addPromptButton.addEventListener('click', handleAddPromptClick);
    promptInput.addEventListener('change', handlePromptFileSelect);
    promptText.addEventListener('input', handlePromptTextChangeDebounced);
    
    // Set up chat slot button listeners
    for (let i = 0; i < 10; i++) {
        const button = document.getElementById(`chat-slot-${i}`);
        button.addEventListener('click', () => handleChatSlotClick(i));
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, i);
        });
    }
    
    // Context menu listeners
    renameOption.addEventListener('click', handleRename);
    exportOption.addEventListener('click', handleExportChat);
    clearDataOption.addEventListener('click', handleClearData);
    document.addEventListener('click', hideContextMenu);
    
    // User bubble menu listeners
    regenerateOption.addEventListener('click', handleUserBubbleRegenerate);
    deleteOption.addEventListener('click', handleUserBubbleDelete);
    editOption.addEventListener('click', handleUserBubbleEdit);
    document.addEventListener('contextmenu', (e) => {
        // Only prevent default on chat buttons (already handled above)
        // Let other right-clicks work normally
    });
    
    // Clear all button listener
    clearAllButton.addEventListener('click', handleClearAll);
    
    // View button listeners
    viewPromptButton.addEventListener('click', showPromptView);
    viewFilesButton.addEventListener('click', showFilesView);
    viewReadmeButton.addEventListener('click', showReadmeView);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllViews();
        }
    });
    
    // Model select listener
    modelSelect.addEventListener('change', handleModelSelect);
    
    // Send button listener
    sendButton.addEventListener('click', handleSendMessage);
    
    // API Key button listener
    apiKeyButton.addEventListener('click', handleApiKeyManagement);
    
    // Update API key and JSON button text on load
    updateApiKeyButtonText();
    updateJsonButtonText();
    
    // Check if API key exists
    const hasApiKey = getApiKey();
    
    // Load last active tab or default
    const savedTab = localStorage.getItem('lastActiveTab');
    if (!hasApiKey) {
        // No API key: always show README
        showReadmeView();
    } else if (savedTab) {
        // API key exists: restore last tab
        lastActiveTab = savedTab;
        if (savedTab === 'files') showFilesView();
        else if (savedTab === 'readme') showReadmeView();
        else showPromptView(); // default to prompt view
    } else {
        // First time with API key: show prompt
        showPromptView();
    }
}

// Handle "Add File" button click
function handleAddJsonClick() {
    if (currentFile) {
        // File exists, remove it
        if (confirm(`Remove the current file (${currentFile.name})? This will delete it from the library.`)) {
            const fileName = currentFile.name;
            const fileType = currentFile.type;
            
            // Delete from file library
            const fileIndex = fileLibrary.findIndex(f => f.name === fileName && f.type === fileType);
            if (fileIndex >= 0) {
                fileLibrary.splice(fileIndex, 1);
                saveFileLibrary();
            }
            
            // Clear the current file
            currentFile = null;
            
            // Reset the file input
            fileInput.value = '';
            
            // Update display
            updateActiveFileDisplay();
            updateJsonButtonText();
            
            // Save to active chat
            if (activeChatSlot !== null) {
                const chat = chatHistory[activeChatSlot];
                chat.jsonFile = null;
                saveChatHistory();
            }
            
            // If Files tab is active, refresh it (may show empty state or other file)
            if (lastActiveTab === 'files') {
                showFilesView();
            }
        }
    } else {
        // No file, add one
        fileInput.click();
    }
}

// Update file button text based on whether a file is loaded
function updateJsonButtonText() {
    if (currentFile) {
        addJsonButton.textContent = 'Remove File';
    } else {
        addJsonButton.textContent = 'Add File';
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Determine file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Read the file
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const rawContent = e.target.result;
        let content;
        let fileType;
        
        if (fileExtension === 'json') {
            // Handle JSON file
            try {
                content = JSON.parse(rawContent);
                fileType = 'json';
            } catch (error) {
                alert('Error: Invalid JSON file. Please select a valid JSON file.');
                console.error('JSON parse error:', error);
                return;
            }
        } else if (fileExtension === 'md') {
            // Handle Markdown file
            content = rawContent;
            fileType = 'markdown';
        } else {
            alert('Error: Unsupported file type. Please select a .json or .md file.');
            return;
        }
        
        // Store the file in memory
        currentFile = {
            name: file.name,
            content: content,
            type: fileType
        };
        
        // Add to file library
        addFileToLibrary(file.name, content, fileType);
        
        // Save to active chat (replaces any existing file)
        if (activeChatSlot !== null) {
            chatHistory[activeChatSlot].jsonFile = {
                name: file.name,
                content: content,
                type: fileType
            };
            saveChatHistory();
            console.log('File saved to chat:', chatHistory[activeChatSlot].name);
        }
        
        // Update the display
        updateActiveFileDisplay();
        updateJsonButtonText();
        
        // Refresh Files view if it's currently active
        if (lastActiveTab === 'files') {
            showFilesView();
        }
        
        console.log('File loaded:', currentFile.name);
        console.log('Type:', fileType);
        console.log('Content:', content);
    };
    
    reader.onerror = function() {
        alert('Error: Could not read file.');
        console.error('File read error');
    };
    
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    fileInput.value = '';
}

// Update the active file display in header
function updateActiveFileDisplay() {
    if (currentFile) {
        activeFileDisplay.textContent = `Active: ${currentFile.name}`;
        activeFileDisplay.style.color = '#333';
        activeFileDisplay.style.fontWeight = 'bold';
    } else {
        activeFileDisplay.textContent = 'No file loaded';
        activeFileDisplay.style.color = '#666';
        activeFileDisplay.style.fontWeight = 'normal';
    }
}

// Handle "Add Prompt" button click
function handleAddPromptClick() {
    if (activeChatSlot === null) {
        alert('Select a chat before adding prompt');
        return;
    }
    promptInput.click();
}

// Handle prompt file selection
function handlePromptFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Read the file
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        
        // Store the prompt text
        currentPrompt = content;
        
        // Display in textarea
        promptText.value = content;
        
        // Add to file library
        addFileToLibrary(file.name, content, 'prompt');
        
        // Save to active chat
        if (activeChatSlot !== null) {
            chatHistory[activeChatSlot].prompt = content;
            chatHistory[activeChatSlot].promptFileName = file.name;
            saveChatHistory();
        }
        
        // Refresh Files view if it's currently active
        if (lastActiveTab === 'files') {
            showFilesView();
        }
        
        console.log('Prompt loaded from:', file.name);
        console.log('Prompt length:', content.length, 'characters');
    };
    
    reader.onerror = function() {
        alert('Error: Could not read prompt file.');
        console.error('File read error');
    };
    
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    promptInput.value = '';
}

// Handle prompt text changes with debouncing (300ms)
function handlePromptTextChangeDebounced(event) {
    currentPrompt = event.target.value;
    
    // Clear existing timeout
    if (promptUpdateTimeout) {
        clearTimeout(promptUpdateTimeout);
    }
    
    // Set new timeout to save after 300ms of no typing
    promptUpdateTimeout = setTimeout(() => {
        if (activeChatSlot !== null) {
            chatHistory[activeChatSlot].prompt = currentPrompt;
            saveChatHistory();
            console.log('Prompt auto-saved for chat:', chatHistory[activeChatSlot].name);
            
            // Update last edited timestamp if prompt came from a file
            if (chatHistory[activeChatSlot].promptFileName) {
                const file = fileLibrary.find(f => 
                    f.name === chatHistory[activeChatSlot].promptFileName && f.type === 'prompt'
                );
                if (file) {
                    file.content = currentPrompt;
                    file.lastEditedAt = Date.now();
                    saveFileLibrary();
                }
            }
        }
    }, 300);
}

// Chat History Functions

// Initialize chat history from localStorage
function initChatHistory() {
    const saved = localStorage.getItem('karenOS_chats');
    
    if (saved) {
        chatHistory = JSON.parse(saved);
        
        // Add createdAt to old chats that don't have it
        let needsSave = false;
        chatHistory.forEach(chat => {
            if (chat !== null && !chat.createdAt) {
                chat.createdAt = Date.now();
                needsSave = true;
            }
        });
        
        if (needsSave) {
            saveChatHistory();
        }
    } else {
        // Create empty 10-slot array
        chatHistory = Array(10).fill(null);
        saveChatHistory();
    }
    
    updateChatButtons();
}

// Save chat history to localStorage
function saveChatHistory() {
    localStorage.setItem('karenOS_chats', JSON.stringify(chatHistory));
}

// Handle chat slot button click
function handleChatSlotClick(slotIndex) {
    const chat = chatHistory[slotIndex];
    
    if (chat === null) {
        // Empty slot - prompt for name
        const chatName = prompt('Enter a name for this chat:');
        
        if (chatName && chatName.trim() !== '') {
            // Create new chat
            chatHistory[slotIndex] = {
                name: chatName.trim(),
                messages: [],
                prompt: '',
                jsonFile: null,
                model: null,
                createdAt: Date.now()
            };
            saveChatHistory();
            setActiveChat(slotIndex);
        }
    } else {
        // Load existing chat
        setActiveChat(slotIndex);
    }
}

// Set the active chat
function setActiveChat(slotIndex) {
    activeChatSlot = slotIndex;
    
    const chat = chatHistory[slotIndex];
    
    // Clear the chat area first
    clearChatArea();
    
    // Load the chat's prompt into the textarea
    if (chat.prompt) {
        promptText.value = chat.prompt;
        currentPrompt = chat.prompt;
    } else {
        promptText.value = '';
        currentPrompt = '';
    }
    
    // Load the chat's JSON file
    if (chat.jsonFile) {
        currentFile = chat.jsonFile;
        console.log('JSON loaded:', chat.jsonFile.name);
    } else {
        currentFile = null;
    }
    updateJsonButtonText();
    
    // Load the chat's model
    if (chat.model) {
        modelSelect.value = chat.model;
        selectedModel = chat.model;
        console.log('Model loaded:', chat.model);
    } else {
        modelSelect.value = '';
        selectedModel = null;
        console.log('No model saved for this chat');
    }
    
    // Load and display chat messages
    if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach((msg, index) => {
            // Pass index for all messages to enable context menu on user bubbles
            renderChatBubble(msg.content, msg.role, msg.timestamp, msg.model, msg.ttft, msg.reasoning, index);
        });
        console.log(`Loaded ${chat.messages.length} messages`);
    }
    
    updateChatButtons();
    updateActiveChatDisplay();
    updateActiveFileDisplay();
    
    // Refresh Files view if it's currently visible
    if (lastActiveTab === 'files') {
        showFilesView();
    }
    
    console.log('Active chat:', chat.name);
    console.log('Prompt loaded:', chat.prompt ? chat.prompt.length + ' characters' : 'no prompt');
    console.log('JSON loaded:', chat.jsonFile ? chat.jsonFile.name : 'no JSON');
}

// Clear all messages from the chat area
function clearChatArea() {
    chatMessages.innerHTML = '';
}

// Format timestamp for display
function formatChatTimestamp(timestamp) {
    const date = new Date(timestamp);
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dateNum = date.getDate();
    
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${dayName}, ${monthName} ${dateNum} at ${hours}:${minutesStr} ${ampm}`;
}

// Display chat metadata header
function displayChatHeader(chat) {
    const header = document.createElement('div');
    header.className = 'chat-header';
    
    const modelName = chat.model || 'No model selected';
    const timestamp = chat.createdAt ? formatChatTimestamp(chat.createdAt) : 'Unknown date';
    
    header.innerHTML = `
        <div class="chat-header-line">
            <span class="chat-header-label">Model:</span>
            <span class="chat-header-value">${modelName}</span>
        </div>
        <div class="chat-header-line">
            <span class="chat-header-label">Created:</span>
            <span class="chat-header-value">${timestamp}</span>
        </div>
    `;
    
    chatMessages.appendChild(header);
}

// Update all chat button labels
function updateChatButtons() {
    for (let i = 0; i < 10; i++) {
        const button = document.getElementById(`chat-slot-${i}`);
        const chat = chatHistory[i];
        
        if (chat === null) {
            button.textContent = `${i + 1}. Empty...`;
            button.classList.remove('active');
        } else {
            button.textContent = `${i + 1}. ${chat.name}`;
            
            if (i === activeChatSlot) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }
}

// Update the active chat display in middle panel
function updateActiveChatDisplay() {
    if (activeChatSlot !== null) {
        const chat = chatHistory[activeChatSlot];
        // chatNameDisplay.textContent = chat.name; // Removed - redundant display
        updateMessagePairCounter();
    } else {
        // chatNameDisplay.textContent = 'No chat selected'; // Removed - redundant display
        if (stackIcon) {
            stackIcon.textContent = '0';
            stackIcon.classList.remove('warning', 'danger');
        }
    }
}

// Update the message pair counter with color coding
function updateMessagePairCounter() {
    if (!stackIcon) return; // Safety check
    
    if (activeChatSlot === null) {
        stackIcon.textContent = '0';
        stackIcon.classList.remove('warning', 'danger');
        return;
    }
    
    const chat = chatHistory[activeChatSlot];
    const messageCount = chat.messages ? chat.messages.length : 0;
    const pairCount = Math.floor(messageCount / 2);
    
    stackIcon.textContent = pairCount;
    
    // Remove existing color classes
    stackIcon.classList.remove('warning', 'danger');
    
    // Add appropriate color class
    if (pairCount >= 40) {
        stackIcon.classList.add('danger');
    } else if (pairCount >= 35) {
        stackIcon.classList.add('warning');
    }
}

// Context Menu Functions

// Show context menu at mouse position
function showContextMenu(event, slotIndex) {
    contextMenuTargetSlot = slotIndex;
    
    // Position menu at cursor
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.style.display = 'block';
}

// Hide context menu
function hideContextMenu() {
    contextMenu.style.display = 'none';
    userBubbleMenu.style.display = 'none';
    contextMenuTargetSlot = null;
    userBubbleMenuTargetIndex = null;
}

// Handle rename option
function handleRename() {
    if (contextMenuTargetSlot === null) return;
    
    const chat = chatHistory[contextMenuTargetSlot];
    const currentName = chat ? chat.name : '';
    
    const newName = prompt('Enter new name:', currentName);
    
    if (newName && newName.trim() !== '') {
        // Create or update chat
        if (chat === null) {
            chatHistory[contextMenuTargetSlot] = {
                name: newName.trim(),
                messages: [],
                prompt: '',
                jsonFile: null,
                model: null,
                createdAt: Date.now()
            };
        } else {
            chat.name = newName.trim();
        }
        
        saveChatHistory();
        updateChatButtons();
        
        // Update active chat display if this is the active chat
        if (contextMenuTargetSlot === activeChatSlot) {
            updateActiveChatDisplay();
        }
    }
    
    hideContextMenu();
}

// Handle export chat option
function handleExportChat() {
    if (contextMenuTargetSlot === null) return;
    
    const chat = chatHistory[contextMenuTargetSlot];
    
    if (chat === null) {
        alert('This chat is empty - nothing to export');
        hideContextMenu();
        return;
    }
    
    // Format reference data as it appears in the payload
    let formattedReferenceData = null;
    if (chat.jsonFile) {
        formattedReferenceData = 'Reference Data:\n' + JSON.stringify(chat.jsonFile.content, null, 2);
    }
    
    // Clean up messages - remove ttft and timestamp, keep model and attachment
    const cleanedMessages = (chat.messages || []).map(msg => {
        const cleaned = {
            role: msg.role,
            content: msg.content
        };
        // Keep attachment for user messages
        if (msg.role === 'user') {
            cleaned.attachment = msg.attachment || null;
        }
        // Keep model for assistant messages
        if (msg.role === 'assistant' && msg.model) {
            cleaned.model = msg.model;
        }
        // Keep reasoning if it exists
        if (msg.reasoning) {
            cleaned.reasoning = msg.reasoning;
        }
        return cleaned;
    });
    
    // Generate version from timestamp (YYYYMMDD.HHMMSS)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const exportVersion = `${year}${month}${day}.${hours}${minutes}${seconds}`;
    
    // Build the export data structure
    const exportData = {
        chatName: chat.name,
        exportedAt: now.toISOString(),
        createdAt: chat.createdAt ? new Date(chat.createdAt).toISOString() : null,
        model: chat.model || null,
        systemPrompt: chat.prompt || null,
        referenceData: formattedReferenceData,
        messages: cleanedMessages,
        metadata: {
            totalMessages: cleanedMessages.length,
            messagePairs: Math.floor(cleanedMessages.length / 2),
            exportSource: 'Fusion Studio',
            exportVersion: exportVersion
        },
        note: "In the actual API payload sent to the model, the systemPrompt is sent first as a system message, followed by all previous conversation messages, then the referenceData (if any) is injected as a system message immediately before each user request. The 'attachment' field in user messages indicates which JSON file was active at the time of that request."
    };
    
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename with chat name and timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const sanitizedName = chat.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedName}_${timestamp}.json`;
    
    link.href = url;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log('Chat exported:', chat.name);
    hideContextMenu();
}

// Handle clear data option
function handleClearData() {
    if (contextMenuTargetSlot === null) return;
    
    const confirmed = confirm('Clear all messages from this chat? Your prompt, model, and JSON will remain.');
    
    if (confirmed) {
        const chat = chatHistory[contextMenuTargetSlot];
        
        // Only clear the messages, keep everything else
        chat.messages = [];
        
        // If this is the active chat, clear the chat area
        if (contextMenuTargetSlot === activeChatSlot) {
            clearChatArea();
            updateMessagePairCounter();
            
            // Refresh Files view if it's currently visible
            if (lastActiveTab === 'files') {
                showFilesView();
            }
        }
        
        saveChatHistory();
        updateChatButtons();
    }
    
    hideContextMenu();
}

// Handle clear all button
function handleClearAll() {
    // Confirmation
    const confirmed = confirm('Are you sure you want to clear all chat data?');
    
    if (confirmed) {
        // Clear all chat slots
        chatHistory = Array(10).fill(null);
        activeChatSlot = null;
        
        // Clear chat area
        clearChatArea();
        
        // Save and update UI
        saveChatHistory();
        updateChatButtons();
        updateActiveChatDisplay();
        updateMessagePairCounter();
        
        console.log('All chats cleared');
    }
}

// View Modal Functions

// Hide all views
function hideAllViews() {
    promptText.parentElement.style.display = 'none';
    filesModal.classList.add('is-hidden');
    fileViewerPane.classList.add('is-hidden');
    readmeModal.classList.add('is-hidden');
}

// Set active view button
function setActiveViewButton(activeButtonId) {
    // Remove active class from all view buttons
    viewPromptButton.classList.remove('active');
    viewFilesButton.classList.remove('active');
    viewReadmeButton.classList.remove('active');
    
    // Add active class to the specified button
    document.getElementById(activeButtonId).classList.add('active');
}

// Show prompt view
function showPromptView() {
    hideAllViews();
    setActiveViewButton('viewPromptButton');
    promptText.parentElement.style.display = 'block';
    lastActiveTab = 'prompt';
    localStorage.setItem('lastActiveTab', lastActiveTab);
}

// Show files view - automatically opens file viewer
function showFilesView() {
    hideAllViews();
    setActiveViewButton('viewFilesButton');
    
    // Check if there's an active chat
    if (activeChatSlot === null) {
        filesModal.classList.remove('is-hidden');
        const filesContent = document.getElementById('filesContent');
        filesContent.innerHTML = '<div class="files-empty">No chat selected. Select a chat to view its files.</div>';
        lastActiveTab = 'files';
        localStorage.setItem('lastActiveTab', lastActiveTab);
        return;
    }
    
    const chat = chatHistory[activeChatSlot];
    
    // Priority: Prompt file first, then attached file (JSON or Markdown)
    if (chat.promptFileName) {
        const promptFile = fileLibrary.find(f => f.name === chat.promptFileName && f.type === 'prompt');
        if (promptFile) {
            showFileViewer(promptFile.name, promptFile.content, 'prompt');
            lastActiveTab = 'files';
            localStorage.setItem('lastActiveTab', lastActiveTab);
            return;
        }
    }
    
    if (chat.jsonFile) {
        const attachedFile = fileLibrary.find(f => f.name === chat.jsonFile.name && (f.type === 'json' || f.type === 'markdown'));
        if (attachedFile) {
            showFileViewer(attachedFile.name, attachedFile.content, attachedFile.type);
            lastActiveTab = 'files';
            localStorage.setItem('lastActiveTab', lastActiveTab);
            return;
        }
    }
    
    // No files - show empty state
    filesModal.classList.remove('is-hidden');
    const filesContent = document.getElementById('filesContent');
    filesContent.innerHTML = '<div class="files-empty">This chat has no files yet. Add a prompt or file to see them here.</div>';
    lastActiveTab = 'files';
    localStorage.setItem('lastActiveTab', lastActiveTab);
}

// Show README view
function showReadmeView() {
    hideAllViews();
    setActiveViewButton('viewReadmeButton');
    readmeModal.classList.remove('is-hidden');
    lastActiveTab = 'readme';
    localStorage.setItem('lastActiveTab', lastActiveTab);
}

// Show file viewer with content in right panel
function showFileViewer(fileName, content, fileType) {
    fileViewerTitle.textContent = fileName;
    
    // Format content based on type
    if (fileType === 'chat' || fileType === 'json') {
        // Show formatted JSON
        fileViewerContent.textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    } else {
        // Show plain text (prompts and markdown)
        fileViewerContent.textContent = content;
    }
    
    // Hide prompt editor and show file viewer in right panel
    promptText.parentElement.style.display = 'none';
    fileViewerPane.classList.remove('is-hidden');
}

// Model Management Functions

// Initialize model list from localStorage
function initModelList() {
    const saved = localStorage.getItem('karenOS_models');
    
    if (saved) {
        modelList = JSON.parse(saved);
    } else {
        modelList = [];
        saveModelList();
    }
    
    populateModelDropdown();
    
    // Auto-select if only one model
    if (modelList.length === 1) {
        selectedModel = modelList[0];
        modelSelect.value = selectedModel;
    }
}

// File Library Functions

// Initialize file library from localStorage
function initFileLibrary() {
    const saved = localStorage.getItem('fileLibrary');
    if (saved) {
        fileLibrary = JSON.parse(saved);
    }
}

// Save file library to localStorage
function saveFileLibrary() {
    localStorage.setItem('fileLibrary', JSON.stringify(fileLibrary));
}

// Add or update file in library
function addFileToLibrary(name, content, type) {
    const existingIndex = fileLibrary.findIndex(f => f.name === name && f.type === type);
    const now = Date.now();
    
    if (existingIndex >= 0) {
        // Update existing file
        fileLibrary[existingIndex].content = content;
        fileLibrary[existingIndex].lastEditedAt = now;
    } else {
        // Add new file
        fileLibrary.push({
            name: name,
            content: content,
            type: type, // 'prompt' or 'json'
            createdAt: now,
            lastEditedAt: now,
            lastUsedAt: null
        });
    }
    
    saveFileLibrary();
}

// Update file's last used timestamp
function updateFileLastUsed(name, type) {
    const file = fileLibrary.find(f => f.name === name && f.type === type);
    if (file) {
        file.lastUsedAt = Date.now();
        saveFileLibrary();
    }
}

// Format file timestamp for display
function formatFileTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const timeStr = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    if (diffDays === 0) {
        return `${timeStr} Today`;
    } else if (diffDays === 1) {
        return `${timeStr} Yesterday`;
    } else {
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        return `${timeStr} ${dateStr}`;
    }
}

// Generate export JSON for a chat
function generateChatExport(chat, slotIndex) {
    // Clean up messages - remove ttft and timestamp, keep model and attachment
    const cleanedMessages = (chat.messages || []).map(msg => {
        const cleaned = {
            role: msg.role,
            content: msg.content
        };
        
        if (msg.role === 'assistant' && msg.model) {
            cleaned.model = msg.model;
        }
        
        if (msg.role === 'user' && msg.attachment) {
            cleaned.attachment = msg.attachment;
        }
        
        return cleaned;
    });
    
    // Generate version from timestamp (YYYYMMDD.HHMMSS)
    const now = new Date();
    const exportVersion = now.getFullYear().toString() +
                         (now.getMonth() + 1).toString().padStart(2, '0') +
                         now.getDate().toString().padStart(2, '0') + '.' +
                         now.getHours().toString().padStart(2, '0') +
                         now.getMinutes().toString().padStart(2, '0') +
                         now.getSeconds().toString().padStart(2, '0');
    
    return {
        chatName: chat.name,
        createdAt: chat.createdAt ? new Date(chat.createdAt).toISOString() : null,
        exportedAt: now.toISOString(),
        slotIndex: slotIndex,
        systemPrompt: chat.prompt || null,
        model: chat.model || null,
        referenceData: chat.jsonFile || null,
        messages: cleanedMessages,
        metadata: {
            totalMessages: cleanedMessages.length,
            messagePairs: Math.floor(cleanedMessages.length / 2),
            exportSource: 'Fusion Studio',
            exportVersion: exportVersion
        },
        note: "In the actual API payload sent to the model, the systemPrompt is sent first as a system message, followed by all previous conversation messages, then the referenceData (if any) is injected as a system message immediately before each user request. The 'attachment' field in user messages indicates which JSON file was active at the time of that request."
    };
}

// Save model list to localStorage
function saveModelList() {
    localStorage.setItem('karenOS_models', JSON.stringify(modelList));
}

// Populate model dropdown with current models
function populateModelDropdown() {
    // Get the hardcoded models from HTML (preserve them)
    const hardcodedModels = [
        'deepseek/deepseek-v3.1-terminus',
        'qwen/qwen3-235b-a22b-2507',
        'qwen/qwen3-235b-a22b-thinking-2507',
        'inclusionai/ling-1t',
        'inclusionai/ring-1t',
        'moonshotai/kimi-k2-0905'
    ];
    
    // Clear dropdown
    modelSelect.innerHTML = '<option value="">Select Model</option>';
    
    // Add hardcoded models first
    hardcodedModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });
    
    // Add custom models from localStorage (if they're not duplicates)
    modelList.forEach(model => {
        if (!hardcodedModels.includes(model)) {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        }
    });
    
    // Add the "Add Model" option at the end
    const addOption = document.createElement('option');
    addOption.value = '__add__';
    addOption.textContent = '+ Add Model';
    addOption.className = 'add-model-option';
    modelSelect.appendChild(addOption);
}

// Handle model selection change
function handleModelSelect(event) {
    const value = event.target.value;
    
    if (value === '__add__') {
        // User selected "Add Model"
        handleAddModel();
        return;
    }
    
    // Save the model to the active chat if one is selected
    if (activeChatSlot !== null && chatHistory[activeChatSlot]) {
        const chat = chatHistory[activeChatSlot];
        
        if (value !== '') {
            chat.model = value;
            selectedModel = value;
            saveChatHistory();
            console.log('Model changed to:', selectedModel);
        } else {
            chat.model = null;
            selectedModel = null;
        }
    } else {
        // No active chat - just set the model
        if (value !== '') {
            selectedModel = value;
            console.log('Model selected:', selectedModel);
        } else {
            selectedModel = null;
        }
    }
}

// Handle adding a new model
function handleAddModel() {
    const modelName = prompt('Enter model name:');
    
    if (modelName && modelName.trim() !== '') {
        const trimmedName = modelName.trim();
        
        // Check if model already exists
        if (modelList.includes(trimmedName)) {
            alert('This model already exists in the list.');
            modelSelect.value = trimmedName;
            selectedModel = trimmedName;
            return;
        }
        
        // Add to list
        modelList.push(trimmedName);
        saveModelList();
        populateModelDropdown();
        
        // Auto-select the new model
        modelSelect.value = trimmedName;
        selectedModel = trimmedName;
        
        console.log('Model added:', trimmedName);
    } else {
        // User cancelled or entered empty string
        // Reset dropdown to previous selection or empty
        if (selectedModel) {
            modelSelect.value = selectedModel;
        } else {
            modelSelect.value = '';
        }
    }
}

// API Key Management

// Handle API key button click
function handleApiKeyManagement() {
    const currentKey = getApiKey();
    
    if (currentKey) {
        // Key exists, offer to clear it
        if (confirm('Clear your API key? You will need to re-enter it to use the app.')) {
            localStorage.removeItem('karenOS_apiKey');
            alert('API Key cleared!');
            updateApiKeyButtonText();
        }
    } else {
        // No key, prompt to add one
        const newKey = prompt('Enter your OpenRouter API Key:');
        
        if (newKey !== null && newKey.trim() !== '') {
            saveApiKey(newKey.trim());
            alert('API Key saved!');
            updateApiKeyButtonText();
        }
    }
}

// Update API key button text based on whether a key exists
function updateApiKeyButtonText() {
    const apiKeyButton = document.getElementById('apiKeyButton');
    const currentKey = getApiKey();
    
    if (currentKey) {
        apiKeyButton.textContent = 'Clear API Key';
    } else {
        apiKeyButton.textContent = 'Add API Key';
    }
}

// Save API key to localStorage
function saveApiKey(key) {
    localStorage.setItem('karenOS_apiKey', key);
}

// Get API key from localStorage
function getApiKey() {
    return localStorage.getItem('karenOS_apiKey');
}

// Send Message Function

// Handle send button click
async function handleSendMessage() {
    // Check if a chat is selected
    if (activeChatSlot === null) {
        alert('Please select a chat first');
        return;
    }
    
    // Check if chat has reached 50 pair limit
    const chat = chatHistory[activeChatSlot];
    const messageCount = chat.messages ? chat.messages.length : 0;
    const pairCount = Math.floor(messageCount / 2);
    
    if (pairCount >= 50) {
        alert('This chat has reached the maximum of 50 message pairs. Please start a new chat.');
        return;
    }
    
    // Check if API key is set
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('Please set your API Key first');
        return;
    }
    
    // Check if model is selected
    if (!selectedModel) {
        alert('Please select a model first');
        return;
    }
    
    // Check if there's a system prompt
    if (!chat.prompt || chat.prompt.trim() === '') {
        const proceed = confirm('You are about to send a chat request with no system prompt. Continue?');
        if (!proceed) {
            return;
        }
    }
    
    // Get the message text
    let message = messageInput.value.trim();
    
    // If message is empty and thread is empty, auto-send test question
    if (message === '' && (!chat.messages || chat.messages.length === 0)) {
        message = 'How many "r" in strawberry?';
        messageInput.value = message;
    } else if (message === '') {
        alert('Please enter a message');
        return;
    }
    
    // Save the selected model to the chat if not already saved
    if (!chat.model && selectedModel) {
        chat.model = selectedModel;
        saveChatHistory();
        
        // Update the chat to show the new model in message metadata
        clearChatArea();
        
        // Re-render existing messages
        if (chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(msg => {
                renderChatBubble(msg.content, msg.role, msg.timestamp, msg.model, msg.ttft, msg.reasoning);
            });
        }
    }
    
    // Remove regenerate button from any previous assistant bubbles
    const oldRegenBtn = chatMessages.querySelector('.regenerate-btn');
    if (oldRegenBtn) {
        oldRegenBtn.remove();
    }
    
    // Render the user's message in the chat area (optimistic render)
    const userBubble = createChatBubble(message, 'user');
    
    // Clear the input
    messageInput.value = '';
    
    // Build the API payload
    const payload = buildApiPayload(message);
    
    // Create empty assistant bubble for streaming (with current timestamp and model)
    const assistantBubble = createChatBubble('', 'assistant', Date.now(), selectedModel);
    
    // Send to OpenRouter API with streaming
    try {
        const { fullMessage, ttft, reasoning } = await streamFromOpenRouter(payload, apiKey, assistantBubble);
        
        // Save to chat history with TTFT, reasoning, and attachment info
        const attachmentName = currentFile ? currentFile.name : null;
        const messageIndex = saveChatMessage(message, fullMessage, ttft, reasoning, attachmentName);
        
        // Add message indices to both bubbles
        if (messageIndex !== null) {
            // User message is at messageIndex - 1
            const userMessageIndex = messageIndex - 1;
            userBubble.dataset.messageIndex = userMessageIndex;
            
            // Add right-click context menu to the user bubble
            userBubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, userMessageIndex);
            });
            userBubble.style.cursor = 'context-menu';
            
            // Assistant message is at messageIndex
            assistantBubble.dataset.messageIndex = messageIndex;
        }
    } catch (error) {
        console.error('API Error:', error);
        renderChatBubble('Error: ' + error.message, 'error');
    }
}

// Build API payload for OpenRouter
function buildApiPayload(userMessage) {
    const messages = [];
    
    // Add system prompt if exists (behavioral instructions)
    if (currentPrompt && currentPrompt.trim() !== '') {
        messages.push({
            role: 'system',
            content: currentPrompt
        });
    }
    
    // Add all previous messages from chat history
    const chat = chatHistory[activeChatSlot];
    if (chat && chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });
    }
    
    // Add file context at the end (reference data - fresh in context)
    if (currentFile) {
        let fileContent;
        if (currentFile.type === 'json') {
            fileContent = 'Reference Data (JSON):\n' + JSON.stringify(currentFile.content, null, 2);
        } else if (currentFile.type === 'markdown') {
            fileContent = 'Reference Data (Markdown):\n' + currentFile.content;
        }
        messages.push({
            role: 'system',
            content: fileContent
        });
    }
    
    // Add current user message
    messages.push({
        role: 'user',
        content: userMessage
    });
    
    return {
        model: selectedModel,
        messages: messages,
        stream: true,
        reasoning: {
            enabled: true,
            effort: "high"
        }
    };
}

// Stream response from OpenRouter API
async function streamFromOpenRouter(payload, apiKey, bubbleElement) {
    // Start timer
    const startTime = Date.now();
    let timerInterval = null;
    let firstTokenReceived = false;
    
    // Create timer display
    const timerDiv = document.createElement('div');
    timerDiv.className = 'token-timer timer-saved';
    timerDiv.textContent = '⏱️ 0.00s';
    
    // Append to bubble (will be positioned in upper right by CSS)
    bubbleElement.appendChild(timerDiv);
    
    // Update timer every 10ms
    timerInterval = setInterval(() => {
        if (!firstTokenReceived) {
            const elapsed = (Date.now() - startTime) / 1000;
            timerDiv.textContent = `⏱️ ${elapsed.toFixed(2)}s`;
        }
    }, 10);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'Fusion Studio'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        clearInterval(timerInterval);
        const error = await response.json();
        const errorMsg = error.error?.message || 'API request failed';
        
        // Add helpful hint for authentication errors
        if (errorMsg.toLowerCase().includes('user not found') || 
            errorMsg.toLowerCase().includes('unauthorized') || 
            errorMsg.toLowerCase().includes('invalid api key')) {
            throw new Error(errorMsg + '\n\n💡 Hint: Click the "API Key" button (between Send and Add JSON) to set or update your OpenRouter API key.');
        }
        
        throw new Error(errorMsg);
    }
    
    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullMessage = '';
    let reasoningText = '';
    let reasoningDiv = null;
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        
        // Split by lines (SSE format)
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                
                if (data === '[DONE]') {
                    break;
                }
                
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    
                    // Debug: Check if we're getting reasoning at all
                    if (delta) {
                        if (delta.reasoning_details && delta.reasoning_details.length > 0) {
                            console.log('✅ Has reasoning_details, length:', delta.reasoning_details.length);
                        } else if (delta.reasoning_content) {
                            console.log('🧠 Has reasoning_content:', delta.reasoning_content.substring(0, 50));
                        } else if (delta.reasoning) {
                            console.log('💭 Has reasoning field:', typeof delta.reasoning);
                        } else if (delta.content && !delta.reasoning_details) {
                            // Only log content once per stream
                            if (fullMessage === '') {
                                console.log('📝 Content only, no reasoning. Full delta keys:', Object.keys(delta));
                            }
                        }
                    }
                    
                    // Handle reasoning tokens - DeepSeek format (string in delta.reasoning)
                    if (delta?.reasoning && typeof delta.reasoning === 'string') {
                        // Stop timer on first token
                        if (!firstTokenReceived) {
                            firstTokenReceived = true;
                            clearInterval(timerInterval);
                            const elapsed = (Date.now() - startTime) / 1000;
                            timerDiv.textContent = `⏱️ ${elapsed.toFixed(2)}s`;
                            timerDiv.classList.add('timer-complete');
                        }
                        
                        reasoningText += delta.reasoning;
                        
                        // Create reasoning section if it doesn't exist
                        if (!reasoningDiv) {
                            reasoningDiv = document.createElement('div');
                            reasoningDiv.className = 'bubble-reasoning';
                            reasoningDiv.innerHTML = '<div class="reasoning-label">🤔 Thinking:</div><div class="reasoning-content"></div>';
                            
                            // Insert before content div
                            const contentDiv = bubbleElement.querySelector('.bubble-content');
                            if (contentDiv) {
                                bubbleElement.insertBefore(reasoningDiv, contentDiv);
                            } else {
                                bubbleElement.appendChild(reasoningDiv);
                            }
                        }
                        
                        // Update reasoning display
                        const reasoningContentDiv = reasoningDiv.querySelector('.reasoning-content');
                        if (reasoningContentDiv) {
                            reasoningContentDiv.innerHTML = marked.parse(reasoningText);
                        }
                    }
                    
                    // Handle reasoning tokens - Inclusion AI format (array in delta.reasoning_details)
                    if (delta?.reasoning_details && delta.reasoning_details.length > 0) {
                        for (const reasoning of delta.reasoning_details) {
                            if (reasoning.type === 'reasoning.text' && reasoning.text) {
                                // Stop timer on first token
                                if (!firstTokenReceived) {
                                    firstTokenReceived = true;
                                    clearInterval(timerInterval);
                                    const elapsed = (Date.now() - startTime) / 1000;
                                    timerDiv.textContent = `⏱️ ${elapsed.toFixed(2)}s`;
                                    timerDiv.classList.add('timer-complete');
                                }
                                
                                reasoningText += reasoning.text;
                                
                                // Create reasoning section if it doesn't exist
                                if (!reasoningDiv) {
                                    reasoningDiv = document.createElement('div');
                                    reasoningDiv.className = 'bubble-reasoning';
                                    reasoningDiv.innerHTML = '<div class="reasoning-label">🤔 Thinking:</div><div class="reasoning-content"></div>';
                                    
                                    // Insert before content div
                                    const contentDiv = bubbleElement.querySelector('.bubble-content');
                                    if (contentDiv) {
                                        bubbleElement.insertBefore(reasoningDiv, contentDiv);
                                    } else {
                                        bubbleElement.appendChild(reasoningDiv);
                                    }
                                }
                                
                                // Update reasoning display
                                const reasoningContentDiv = reasoningDiv.querySelector('.reasoning-content');
                                if (reasoningContentDiv) {
                                    reasoningContentDiv.innerHTML = marked.parse(reasoningText);
                                }
                            }
                        }
                    }
                    
                    // Handle regular content
                    const content = delta?.content;
                    if (content) {
                        // Stop timer on first token
                        if (!firstTokenReceived) {
                            firstTokenReceived = true;
                            clearInterval(timerInterval);
                            const elapsed = (Date.now() - startTime) / 1000;
                            timerDiv.textContent = `⏱️ ${elapsed.toFixed(2)}s`;
                            timerDiv.classList.add('timer-complete');
                        }
                        
                        fullMessage += content;
                        
                        // Update the bubble-content div if it exists, otherwise the whole bubble
                        const contentDiv = bubbleElement.querySelector('.bubble-content');
                        if (contentDiv) {
                            contentDiv.innerHTML = marked.parse(fullMessage);
                        } else {
                            bubbleElement.innerHTML = marked.parse(fullMessage);
                        }
                    }
                    
                    // Auto-scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } catch (e) {
                    // Skip invalid JSON chunks
                    console.debug('Skipping chunk:', e);
                }
            }
        }
    }
    
    // Make sure timer is stopped and get final TTFT
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Calculate final TTFT
    const finalTTFT = firstTokenReceived ? 
        parseFloat(timerDiv.textContent.match(/[\d.]+/)[0]) : 
        (Date.now() - startTime) / 1000;
    
    return { 
        fullMessage, 
        ttft: finalTTFT,
        reasoning: reasoningText 
    };
}

// Save chat message to history
function saveChatMessage(userMessage, aiMessage, ttft = null, reasoning = null, attachment = null) {
    if (activeChatSlot !== null) {
        const chat = chatHistory[activeChatSlot];
        
        if (!chat.messages) {
            chat.messages = [];
        }
        
        chat.messages.push({
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
            attachment: attachment
        });
        
        chat.messages.push({
            role: 'assistant',
            content: aiMessage,
            timestamp: Date.now(),
            model: selectedModel,
            ttft: ttft,
            reasoning: reasoning
        });
        
        saveChatHistory();
        updateMessagePairCounter();
        
        // Update last used timestamp for attached files
        if (chat.jsonFile) {
            updateFileLastUsed(chat.jsonFile.name, 'json');
        }
        if (chat.promptFileName) {
            updateFileLastUsed(chat.promptFileName, 'prompt');
        }
        
        // Return the index of the assistant message
        return chat.messages.length - 1;
    }
    return null;
}

// Create and render a chat bubble (returns the element for streaming)
function createChatBubble(message, role = 'user', timestamp = null, model = null, ttft = null, reasoning = null, messageIndex = null) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    // Store message index for regeneration
    if (messageIndex !== null) {
        bubble.dataset.messageIndex = messageIndex;
    }
    
    if (role === 'assistant') {
        bubble.classList.add('chat-bubble-assistant');
        
        // Add metadata header for assistant messages
        if (timestamp || model) {
            const metadata = document.createElement('div');
            metadata.className = 'bubble-metadata';
            
            const modelName = model || selectedModel || 'Unknown Model';
            const timeString = timestamp ? formatChatTimestamp(timestamp) : formatChatTimestamp(Date.now());
            
            metadata.textContent = `${modelName} - ${timeString}`;
            bubble.appendChild(metadata);
        }
        
        // Add TTFT timer (in upper right)
        if (ttft !== null) {
            const timerDiv = document.createElement('div');
            timerDiv.className = 'token-timer timer-complete timer-saved';
            timerDiv.textContent = `⏱️ ${ttft.toFixed(2)}s`;
            bubble.appendChild(timerDiv);
        }
        
        // Add reasoning section if exists
        if (reasoning && reasoning.trim() !== '') {
            const reasoningDiv = document.createElement('div');
            reasoningDiv.className = 'bubble-reasoning';
            reasoningDiv.innerHTML = '<div class="reasoning-label">🤔 Thinking:</div><div class="reasoning-content"></div>';
            const reasoningContent = reasoningDiv.querySelector('.reasoning-content');
            reasoningContent.innerHTML = marked.parse(reasoning);
            bubble.appendChild(reasoningDiv);
        }
        
        // Create content div
        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.innerHTML = marked.parse(message);
        bubble.appendChild(content);
    } else if (role === 'error') {
        bubble.classList.add('chat-bubble-error');
        bubble.textContent = message;
    } else {
        // User message
        bubble.textContent = message;
        
        // Add right-click handler to user messages
        if (messageIndex !== null) {
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, messageIndex);
            });
            bubble.style.cursor = 'context-menu';
        }
    }
    
    chatMessages.appendChild(bubble);
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return bubble;
}

// Render a chat bubble in the chat area (wrapper for createChatBubble)
function renderChatBubble(message, role = 'user', timestamp = null, model = null, ttft = null, reasoning = null, messageIndex = null) {
    createChatBubble(message, role, timestamp, model, ttft, reasoning, messageIndex);
}

// Show user bubble context menu
function showUserBubbleMenu(event, messageIndex) {
    userBubbleMenuTargetIndex = messageIndex;
    
    // Position the menu at the mouse
    userBubbleMenu.style.left = event.pageX + 'px';
    userBubbleMenu.style.top = event.pageY + 'px';
    userBubbleMenu.style.display = 'block';
}

// Handle regenerate option from user bubble menu
function handleUserBubbleRegenerate() {
    if (userBubbleMenuTargetIndex === null) return;
    
    const messageIndex = userBubbleMenuTargetIndex;
    const chat = chatHistory[activeChatSlot];
    const userMsg = chat.messages[messageIndex];
    
    hideContextMenu();
    
    if (!userMsg || userMsg.role !== 'user') return;
    
    if (!confirm('Regenerate this response? This message and everything after it will be deleted, then the message will be resent.')) {
        return;
    }
    
    // Save the message content BEFORE deleting
    const messageContent = userMsg.content;
    
    // Delete the message and everything after
    deleteMessagesFromIndex(messageIndex);
    
    // Resend the user message
    const originalInput = messageInput.value;
    messageInput.value = messageContent;
    handleSendMessage();
    messageInput.value = originalInput;
}

// Handle delete option from user bubble menu
function handleUserBubbleDelete() {
    if (userBubbleMenuTargetIndex === null) return;
    
    const messageIndex = userBubbleMenuTargetIndex;
    hideContextMenu();
    
    if (!confirm('Delete this message and everything after it? This cannot be undone.')) {
        return;
    }
    
    deleteMessagesFromIndex(messageIndex);
}

// Handle edit option from user bubble menu
function handleUserBubbleEdit() {
    if (userBubbleMenuTargetIndex === null) return;
    
    const messageIndex = userBubbleMenuTargetIndex;
    const chat = chatHistory[activeChatSlot];
    const userMsg = chat.messages[messageIndex];
    
    hideContextMenu();
    
    if (!userMsg || userMsg.role !== 'user') return;
    
    if (!confirm('Edit this message? This message and everything after it will be deleted, and the message text will be placed in the input field.')) {
        return;
    }
    
    // Put the user's message in the input field
    messageInput.value = userMsg.content;
    
    // Delete the message and everything after
    deleteMessagesFromIndex(messageIndex);
    
    // Focus the input
    messageInput.focus();
}

// Helper function to delete a message and everything after it
function deleteMessagesFromIndex(messageIndex) {
    if (activeChatSlot === null) return;
    
    const chat = chatHistory[activeChatSlot];
    if (!chat.messages || messageIndex >= chat.messages.length) return;
    
    // Remove all messages from messageIndex onwards
    const removedCount = chat.messages.length - messageIndex;
    chat.messages.splice(messageIndex, removedCount);
    saveChatHistory();
    
    // Clear and reload the chat area to refresh message indices
    clearChatArea();
    
    // Reload all remaining messages
    if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach((msg, index) => {
            renderChatBubble(msg.content, msg.role, msg.timestamp, msg.model, msg.ttft, msg.reasoning, index);
        });
    }
    
    updateMessagePairCounter();
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);

