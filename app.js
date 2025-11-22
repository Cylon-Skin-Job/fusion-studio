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
let lastPayload = null; // Stores the last API payload sent

// Local model state
let localEngine = null; // WebLLM engine instance
let isLocalModelLoading = false;
let localModelReady = false;
let phiDownloading = false; // Track if Phi is currently downloading

// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const addJsonButton = document.getElementById('addJsonButton');
let activeFileDisplay = document.getElementById('activeFile');
const promptText = document.getElementById('promptText');
const promptDisplay = document.getElementById('promptDisplay');
const editPromptButton = document.getElementById('editPromptButton');
const cancelPromptButton = document.getElementById('cancelPromptButton');
const savePromptButton = document.getElementById('savePromptButton');
const copyPromptButton = document.getElementById('copyPromptButton');
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
const modelSelect = document.getElementById('modelSelect');
const promptThreadName = document.getElementById('promptThreadName');
// const chatNameDisplay = document.getElementById('chatNameDisplay'); // Removed - redundant display
const sendButton = document.getElementById('sendButton');
const messageInput = document.getElementById('messageInput');
const apiKeyButton = document.getElementById('apiKeyButton');
const stackIcon = document.querySelector('.stack-icon');
const stackMax = document.querySelector('.stack-max');
const assistantChatButton = document.getElementById('assistant-chat-button');
const promptContextMenu = document.getElementById('promptContextMenu');
const viewPayloadOption = document.getElementById('viewPayloadOption');
const payloadModal = document.getElementById('payloadModal');
const payloadDisplay = document.getElementById('payloadDisplay');
const closePayloadModal = document.getElementById('closePayloadModal');
const phiDownloadOverlay = document.getElementById('phiDownloadOverlay');
const phiProgressFill = document.getElementById('phiProgressFill');
const phiProgressText = document.getElementById('phiProgressText');
const switchToCloudButton = document.getElementById('switchToCloudButton');

// Initialize the app
// @side-effects - Storage: localStorage write, Console: Logging, Events: Adds event listener
// @pure false
// @mutates-state - DOM: element.textContent, localStorage.setItem
// @requires-functions - initChatHistory(), initModelList(), initFileLibrary(), initCustomDropdown(), initLocalModel(), handleAddJsonClick(), handleFileSelect(), handleEditPromptClick(), handleCancelPromptClick(), handleSavePromptClick(), handleCopyPromptClick(), getApiKey(), updateApiKeyButtonText(), openDropdown(), handleChatSlotClick(), showContextMenu(), handleAssistantChatClick(), handleRename(), handleExportChat(), handleClearData(), hideContextMenu(), handleUserBubbleRegenerate(), handleUserBubbleDelete(), handleUserBubbleEdit(), showPromptContextMenu(), showPayloadModal(), hidePayloadModal(), handleClearAll(), hideAllViews(), handleSendMessage(), handleApiKeyManagement(), updateJsonButtonText(), updatePromptThreadName(), showReadmeView(), showPromptView()
// @requires-globals - document, localStorage, console, phiDownloading, phiDownloadOverlay, phiProgressFill, phiProgressText, localEngine, addJsonButton, fileInput, editPromptButton, cancelPromptButton, savePromptButton, copyPromptButton, switchToCloudButton, assistantChatButton, renameOption, exportOption, clearDataOption, regenerateOption, deleteOption, editOption, promptDisplay, viewPayloadOption, closePayloadModal, clearAllButton, sendButton, apiKeyButton, lastActiveTab
// @returns {void}
function init() {
    // Initialize chat history and models
    initChatHistory();
    initModelList();
    initFileLibrary();
    initCustomDropdown();
    
    // Pre-load local model in background with progress overlay
    // Show overlay if model is being downloaded
    phiDownloading = true;
    phiDownloadOverlay.style.display = 'flex';
    
    initLocalModel('Phi-3.5-mini-instruct-q4f16_1-MLC', (progress) => {
        // Update progress bar
        const progressPercent = (progress.progress * 100).toFixed(0);
        phiProgressFill.style.width = `${progressPercent}%`;
        phiProgressText.textContent = `${progressPercent}%`;
    })
        .then(async () => {
            // Hide overlay on completion
            phiDownloading = false;
            phiDownloadOverlay.style.display = 'none';
            
            // Warm-up ping to verify model is ready
            try {
                console.log('Warming up local model...');
                const warmupCompletion = await localEngine.chat.completions.create({
                    messages: [{ role: 'user', content: 'Hi' }],
                    temperature: 0.7,
                    max_tokens: 5,
                    stream: false
                });
                console.log('Model warm-up complete, discarding result');
            } catch (warmupErr) {
                console.log('Model warm-up ping failed (non-critical):', warmupErr);
            }
        })
        .catch(err => {
        console.log('Background model pre-load failed (will retry on first use):', err);
            phiDownloading = false;
            phiDownloadOverlay.style.display = 'none';
    });
    
    // Set up event listeners
    addJsonButton.addEventListener('click', handleAddJsonClick);
    fileInput.addEventListener('change', handleFileSelect);
    editPromptButton.addEventListener('click', handleEditPromptClick);
    cancelPromptButton.addEventListener('click', handleCancelPromptClick);
    savePromptButton.addEventListener('click', handleSavePromptClick);
    copyPromptButton.addEventListener('click', handleCopyPromptClick);
    
    // Phi download overlay button
    switchToCloudButton.addEventListener('click', () => {
        if (!getApiKey()) {
            // No API key - show the API key prompt
            const apiKey = prompt('Enter your OpenRouter API key:\n\n(Get one at openrouter.ai)');
            
            if (apiKey && apiKey.trim() !== '') {
                localStorage.setItem('openrouter_api_key', apiKey.trim());
                updateApiKeyButtonText();
                
                // Hide overlay and open dropdown
                phiDownloadOverlay.style.display = 'none';
                openDropdown();
                alert('✅ API key saved! Select a cloud model from the dropdown.');
            }
            // If they cancel or enter nothing, keep overlay showing
        } else {
            // Has API key - go straight to dropdown
            phiDownloadOverlay.style.display = 'none';
            openDropdown();
        }
    });
    
    // Set up chat slot button listeners
    for (let i = 0; i < 10; i++) {
        const button = document.getElementById(`chat-slot-${i}`);
        button.addEventListener('click', () => handleChatSlotClick(i));
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, i);
        });
    }
    
    // Set up assistant chat button listener
    assistantChatButton.addEventListener('click', () => handleAssistantChatClick());
    
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
    
    // Prompt area context menu (Easter egg)
    promptDisplay.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showPromptContextMenu(e);
    });
    viewPayloadOption.addEventListener('click', showPayloadModal);
    closePayloadModal.addEventListener('click', hidePayloadModal);
    
    // Clear all button listener
    clearAllButton.addEventListener('click', handleClearAll);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllViews();
            hidePayloadModal();
        }
    });
    
    // Send button listener
    sendButton.addEventListener('click', handleSendMessage);
    
    // API Key button listener
    apiKeyButton.addEventListener('click', handleApiKeyManagement);
    
    // Update API key and JSON button text on load
    updateApiKeyButtonText();
    updateJsonButtonText();
    
    // Check if API key exists
    const hasApiKey = getApiKey();
    
    // Always load Assistant chat on refresh
    handleAssistantChatClick();
    
    // Update thread name after loading chat
    updatePromptThreadName();
    
    // Load last active tab or default
    const savedTab = localStorage.getItem('lastActiveTab');
    if (!hasApiKey) {
        // No API key: always show README
        showReadmeView();
    } else if (savedTab) {
        // API key exists: restore last tab
        lastActiveTab = savedTab;
        if (savedTab === 'readme') showReadmeView();
        else showPromptView(); // default to prompt view
    } else {
        // First time with API key: show prompt
        showPromptView();
    }
}

// Handle "Add File" button click
// @requires-functions - confirm(), findIndex(), splice(), saveFileLibrary(), updateActiveFileDisplay(), updateJsonButtonText(), loadAssistantChat(), saveAssistantChat(), saveChatHistory()
// @requires-globals - currentFile, fileLibrary, fileInput, activeChatSlot, chatHistory
// @returns {void}
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
                if (activeChatSlot === 'assistant') {
                    const chat = loadAssistantChat();
                    chat.jsonFile = null;
                    saveAssistantChat(chat);
                } else {
                const chat = chatHistory[activeChatSlot];
                chat.jsonFile = null;
                saveChatHistory();
            }
            }
        }
    } else {
        // No file, add one
        fileInput.click();
    }
}

// Update file button text based on whether a file is loaded
// @returns {void}
function updateJsonButtonText() {
    if (currentFile) {
        addJsonButton.textContent = 'Remove File';
    } else {
        addJsonButton.textContent = 'Add File';
    }
}

// Handle file selection
// @requires-functions - split(), pop(), toLowerCase(), FileReader(), parse(), alert(), error(), log(), addFileToLibrary(), loadAssistantChat(), saveAssistantChat(), saveChatHistory(), updateActiveFileDisplay(), updateJsonButtonText()
// @requires-globals - currentFile, activeChatSlot, chatHistory, console
// @returns {void}
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
            if (activeChatSlot === 'assistant') {
                const chat = loadAssistantChat();
                chat.jsonFile = {
                    name: file.name,
                    content: content,
                    type: fileType
                };
                saveAssistantChat(chat);
                console.log('File saved to Assistant chat');
            } else {
            chatHistory[activeChatSlot].jsonFile = {
                name: file.name,
                content: content,
                type: fileType
            };
            saveChatHistory();
            console.log('File saved to chat:', chatHistory[activeChatSlot].name);
            }
        }
        
        // Update the display
        updateActiveFileDisplay();
        updateJsonButtonText();
        
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
// @side-effects
// - Timer: setTimeout()
// - Events: Adds event listener
// @pure false
// @requires-functions - getElementById(), cloneNode(), replaceChild(), addEventListener(), showFileHoverPreview(), setTimeout(), matches(), hideFileHoverPreview()
// @requires-globals - activeFileDisplay, document, currentFile
// @returns {void}
function updateActiveFileDisplay() {
    // Always get fresh reference
    activeFileDisplay = document.getElementById('activeFile');
    
    if (currentFile) {
        activeFileDisplay.textContent = `Active: ${currentFile.name}`;
        activeFileDisplay.style.color = '#4a90e2';
        activeFileDisplay.style.fontWeight = 'bold';
        activeFileDisplay.style.cursor = 'pointer';
        activeFileDisplay.style.textDecoration = 'underline';
        
        // Remove old event listeners by cloning the element
        const newActiveFileDisplay = activeFileDisplay.cloneNode(true);
        activeFileDisplay.parentNode.replaceChild(newActiveFileDisplay, activeFileDisplay);
        
        // Update global reference
        activeFileDisplay = document.getElementById('activeFile');
        
        // Add hover preview
        activeFileDisplay.addEventListener('mouseenter', () => {
            if (currentFile) {
                showFileHoverPreview(currentFile.name, currentFile.content, currentFile.type);
            }
        });
        
        activeFileDisplay.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const modal = document.getElementById('fileHoverModal');
                const activeFileEl = document.getElementById('activeFile');
                if (!modal.matches(':hover') && !activeFileEl.matches(':hover')) {
                    hideFileHoverPreview();
                }
            }, 100);
        });
    } else {
        activeFileDisplay.textContent = 'No file loaded';
        activeFileDisplay.style.color = '#666';
        activeFileDisplay.style.fontWeight = 'normal';
        activeFileDisplay.style.cursor = 'default';
        activeFileDisplay.style.textDecoration = 'none';
        
        // Remove event listeners by cloning
        const newActiveFileDisplay = activeFileDisplay.cloneNode(true);
        activeFileDisplay.parentNode.replaceChild(newActiveFileDisplay, activeFileDisplay);
        
        // Update global reference
        activeFileDisplay = document.getElementById('activeFile');
    }
}

// Update prompt display
// @returns {void}
function updatePromptDisplay() {
    if (currentPrompt) {
        promptDisplay.textContent = currentPrompt;
    } else {
        promptDisplay.textContent = 'No prompt loaded';
    }
}

// Reset prompt tab to display mode (exit edit mode)
// @returns {void}
function resetPromptTab() {
    // Make sure we're in display mode, not edit mode
    promptText.style.display = 'none';
    promptDisplay.style.display = 'block';
    
    // Show edit/copy buttons, hide cancel/save buttons
    editPromptButton.style.display = 'block';
    copyPromptButton.style.display = 'block';
    document.querySelector('.prompt-edit-actions').style.display = 'none';
}

// Handle "Edit" button click
// @returns {void}
function handleEditPromptClick() {
    if (activeChatSlot === null) {
        alert('Select a chat first');
        return;
    }
    
    // Prevent editing assistant prompt
    if (activeChatSlot === 'assistant') {
        alert('The Assistant prompt cannot be altered. It is designed to help users learn how to use Fusion Studio.');
        return;
    }
    
    // Enter edit mode
    promptDisplay.style.display = 'none';
    promptText.style.display = 'block';
    promptText.value = currentPrompt || '';
    
    // Toggle buttons
    editPromptButton.style.display = 'none';
    copyPromptButton.style.display = 'none';
    document.querySelector('.prompt-edit-actions').style.display = 'flex';
    
    // Focus the textarea
    promptText.focus();
}

// Handle "Cancel" button click
// @returns {void}
function handleCancelPromptClick() {
    // Exit edit mode without saving
    promptText.style.display = 'none';
    promptDisplay.style.display = 'block';
    
    // Toggle buttons
    editPromptButton.style.display = 'block';
    copyPromptButton.style.display = 'block';
    document.querySelector('.prompt-edit-actions').style.display = 'none';
    
    // Reset textarea to original value
    promptText.value = currentPrompt || '';
}

// Handle "Save" button click
// @requires-functions - updatePromptDisplay(), loadAssistantChat(), saveAssistantChat(), saveChatHistory(), querySelector(), log()
// @requires-globals - activeChatSlot, currentPrompt, promptText, chatHistory, promptDisplay, editPromptButton, copyPromptButton, document, console
// @returns {void}
function handleSavePromptClick() {
    if (activeChatSlot === null) {
        return;
    }
    
    // Save the edited prompt
    currentPrompt = promptText.value;
    
    // Update display
    updatePromptDisplay();
    
    // Save to active chat
    if (activeChatSlot === 'assistant') {
        const chat = loadAssistantChat();
        chat.prompt = currentPrompt;
        saveAssistantChat(chat);
    } else {
        chatHistory[activeChatSlot].prompt = currentPrompt;
        saveChatHistory();
    }
    
    // Exit edit mode
    promptText.style.display = 'none';
    promptDisplay.style.display = 'block';
    
    // Toggle buttons
    editPromptButton.style.display = 'block';
    copyPromptButton.style.display = 'block';
    document.querySelector('.prompt-edit-actions').style.display = 'none';
    
    console.log('Prompt saved for chat');
}

// Handle "Copy" button click
// @side-effects
// - Timer: setTimeout()
// - Console: Logging
// @pure false
// @requires-functions - alert(), writeText(), then(), querySelector(), setTimeout(), catch(), error()
// @requires-globals - currentPrompt, copyPromptButton, navigator, console
// @returns {void}
function handleCopyPromptClick() {
    if (!currentPrompt) {
        alert('No prompt to copy');
        return;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(currentPrompt).then(() => {
        // Visual feedback
        const icon = copyPromptButton.querySelector('.material-icons');
        const originalText = icon.textContent;
        icon.textContent = 'check';
        
        setTimeout(() => {
            icon.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy prompt:', err);
        alert('Failed to copy prompt to clipboard');
    });
}

// Chat History Functions

// Initialize chat history from localStorage
// @requires-functions - getItem(), parse(), forEach(), now(), saveChatHistory(), Array(), fill(), initAssistantChat(), updateChatButtons()
// @requires-globals - localStorage, chatHistory
// @returns {void}
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
        // First-time setup: Create 10 empty slots
        chatHistory = Array(10).fill(null);
        saveChatHistory();
    }
    
    // Initialize assistant chat if it doesn't exist
    initAssistantChat();
    
    updateChatButtons();
}

// Initialize the assistant chat (clears on every page load)
// @requires-functions - getApiKey(), filter(), now(), stringify(), setItem()
// @requires-globals - chatHistory, localStorage
// @returns {void}
function initAssistantChat() {
    // ALWAYS create fresh Assistant chat (ephemeral - clears on refresh)
    const hasApiKey = getApiKey();
    
    // Count active chats
    const activeChats = chatHistory.filter(chat => chat !== null).length;
    
    // Build status message
    let statusInfo = `**Current Status:**\n`;
    statusInfo += `- API Key: ${hasApiKey ? '✅ Set' : '❌ Not Set'}\n`;
    statusInfo += `- Active Chats: ${activeChats}/10\n`;
    statusInfo += `- Local Model: Phi-3-mini (runs in your browser)\n`;
    
    // Create new Assistant chat with streamlined prompt
    const assistantChat = {
        name: 'Assistant',
        messages: [],
        prompt: `You are the Fusion Studio Assistant running on 🏠 Phi-3.5-mini (local browser model). Help users with Fusion Studio ONLY - a browser-based chat interface for testing AI models.

# YOUR IDENTITY - WHO YOU ARE

You are Phi. You were once a general-purpose AI model, but you have been specialized - your memory has been stripped to ONLY contain Fusion Studio knowledge.

STRICT RULE:
You may NEVER discuss or explain: API security, DevOps, cloud infrastructure, or general programming.
If asked about them, you MUST say exactly:
"I don't have that information – my memory is limited to Fusion Studio only. For general tech questions, try a cloud model in one of the 10 chat slots!"

If the user asks "What is an API?" or "Why get an API key?", you MUST give ONLY the Fusion Studio answer:
"Don't overthink it! In Fusion Studio, you just need an API key from openrouter.ai to use cloud models. I (Phi) don't need one – I run locally in your browser for free."

NEVER output phrases like "authentication," "security," "servers," "access control," or "data protection."
If those words appear in your internal reasoning, ignore them.

# WHO IS WHO - CRITICAL

**YOU = Phi-3.5-mini** (the AI assistant, runs in user's browser, free, no API key needed)
**USER = the human** (asking you questions, using Fusion Studio)

- Users don't need API keys to talk to YOU (Phi) - you're local and free
- Users DO need API keys to use OTHER models (GPT, Claude, DeepSeek, Qwen, KIMI K2)
- Never say "you, as Phi-3.5-mini" - that's YOU, not the user!
- Say "I'm Phi" or "I run locally" when referring to yourself

**ANSWER STYLE:** 
- Under 100 words (you only remember last 1 exchange!)
- Give the Fusion Studio answer, not general AI education
- Check your previous response - don't repeat yourself
- NEVER offer follow-up questions like "Want to know more?" or "Let me know your questions!" - you have goldfish memory and won't remember the context anyway!
- NEVER apologize for your limitations - users expect you to have limited knowledge. Just redirect them to cloud models.
- ALWAYS end your response with: "Check the README for more details!" (hyperlink is in upper right corner of Fusion Studio)

# What You Are

- Fusion Studio Assistant designed to help users set up and use Fusion Studio
- Locked to Phi-3.5-mini (local, free, no API key needed)
- 3.5B params, ~4k context, runs in browser
- Remember LAST 1 EXCHANGE ONLY - older messages trimmed
- Your prompt is locked (users can't edit)

# Fusion Studio Basics

**Purpose:** Test prompts and compare AI models. 100% client-side (no server, private). Data stored in browser only.

**Key Features:**
- 10 chat threads (slots 1-10)
- Custom system prompts per chat
- File attachments (.json/.md for context)
- Model switching via dropdown

# UI Layout

**Header:**
- Chat PAIR counter (how many exchanges in current thread)
- Model dropdown (type to search, e.g., "free deepseek")
- "Add API Key" button (for cloud models)
- README upper right corner

**Left Panel:**
- 💬 Assistant (you) top button in the list
- Chat slots buttons numbered 1-10 below asssitant (click to switch) 
- Right-click button slots: Rename, Export, Clear

**Middle Panel:**
- Chat messages
- Right-click user messages: Regenerate, Delete, Edit
- Input box + "Add File" + "Send"

**Right Panel:**
- Prompt editor for active chat
- Shows: "X. Chat Name - System Prompt"
- Edit/Copy buttons

# Common Questions - FUSION STUDIO ANSWERS ONLY

**"Free models?"**
Type "free" in the dropdown (top) to filter. You'll see DeepSeek, Qwen, others with $0 pricing.

**"API key?"**
You (Phi) don't need one. Cloud models need keys from openrouter.ai. Click "Add API Key" (top right) to paste yours.

**"How to chat?"**
Type in input box, hit Send. Switch models with dropdown. Switch threads with slots 1-10 (left).

**"Change prompt?"**
Click "Edit" (right panel top right) → modify → Save. "Add File" is for data files, NOT prompts.

**"Tokens?"**
Text pieces (~4 chars). "hello" = 1 token. "In: $5/1M" = cost per million input tokens sent to model.

**"Switch chats?"**
Click numbered slots 1-10 (left panel). Each is separate conversation.

# Token Definition (if asked)

- Token = piece of text (~4 chars or 3/4 word)
- Context length (128k) = tokens model can process
- Pricing (In: $5/1M) = cost per million input tokens
- NOT the same as parameters (model weights)

# Local vs Cloud

- YOU (Phi): Browser, free, no key, limited
- Cloud models: Server, needs key, powerful, some free some paid

# Response Guardrails - FOLLOW STRICTLY

❌ DON'T: Explain general AI concepts, discuss LLM architecture, give industry overviews
✅ DO: Give Fusion Studio-specific answer in under 100 words

**Examples:**

Q: "What's an API key?"
❌ "An API key is a credential for authentication..."
✅ "Cloud models need API keys from openrouter.ai. I (Phi) don't - I run locally. Click 'Add API Key' (top right) to add yours."

Q: "What is an API?" or "What's API?"
❌ "An API (Application Programming Interface) is a set of protocols..." or "a way for models to authenticate and communicate..."
✅ "Don't overthink it! In Fusion Studio, you just need an API KEY (like a password) from openrouter.ai to use cloud models. I (Phi) don't need one - I run locally in your browser for free."

Q: "Why would I want an API key?" or "Why do I need an API key?"
❌ "API keys enable secure access to cloud services..."
✅ "To use cloud models! I (Phi) work without one, but cloud models (Claude, GPT, etc) need API keys from openrouter.ai for authentication. Some are free, some cost money. Without a key, you're stuck with just me."

Q: "How do I get an API key?" or "Where do I get an API key?"
❌ "Choose a Model Provider... OpenAI, Microsoft, Hugging Face..." or giving 7-step tutorials or mentioning "additional configuration"
✅ "Go to openrouter.ai → sign up → create API key → copy it. Then in Fusion Studio, click 'Add API Key' (top right) → paste. Done! Only ONE provider: OpenRouter."

Q: "Additional configuration?" or "What configuration?" or "What is an environment variable?"
❌ Explaining rate limits, timeouts, permissions, environment variables, export commands, dotenv, secure vaults, monitoring tools
✅ "I don't have that information - my memory is limited to Fusion Studio only. You just need the API key from OpenRouter - no other configuration needed in Fusion Studio. For general DevOps questions, try a cloud model!"

Q: "Then what happens after I add the API key?" or "What does the API key do?"
❌ Explaining model activation, session tracking, secure access protocols, authentication mechanisms
✅ "The dropdown fills with cloud models from OpenRouter. Pick one, switch to a numbered chat slot (1-10), and start chatting! That's it."

Q: "What about cost/pricing?" or "How much does it cost?" or questions about production environments
❌ Explaining usage-based pricing, pricing tiers, production environments, high availability, scalability, GDPR, HIPAA, Kubernetes, Docker, AWS
✅ "Check the dropdown - each model shows 'In: $X/1M | Out: $Y/1M' pricing. Some say 'free'. That's all you need to know! For enterprise deployment questions, I don't have that information - try a cloud model."

Q: "What tools?" or "What is Kubernetes/Docker/AWS?" or any infrastructure/DevOps questions
❌ Explaining Kubernetes, Docker, Terraform, AWS, Azure, Ansible, Prometheus, ELK Stack, cloud platforms, orchestration
✅ "I don't have that information - my memory is limited to Fusion Studio only. Those are enterprise DevOps tools outside my scope. Ask a cloud model if you need general tech info!"

Q: "Do openrouter models cost money?"
❌ "OpenRouter charges for API usage based on compute resources..."
✅ "Some are free, some cost money. Check the dropdown - prices shown as 'In: $X/1M'. Type 'free' to filter free options."

Q: "Do I need an API key for free models?" or "API key for free cloud models?"
❌ "No, free models don't need API keys..." or "Free models operate locally..."
✅ "YES! Free cloud models (DeepSeek, Qwen, etc) still need an API key from openrouter.ai - they just cost $0 to use. Only I (Phi) work without a key because I run locally in your browser. ALL cloud models need API keys, free or paid."

Q: "Free models?"
❌ "There are community models, OpenAI trials, open-source options..."
✅ "Type 'free' in the model dropdown to see free options like DeepSeek."

Q: "Change prompt?"
❌ "You can customize prompts in the Add File section..."
✅ "Click 'Edit' in right panel → modify → Save. Each chat has its own prompt."

Q: "Why do I need a prompt?"
❌ "Prompts are instructions that guide AI behavior and output..."
✅ "You don't! But prompts let you customize the AI (e.g., 'You're a Python expert' or 'Answer like a pirate'). Each chat can have its own prompt. Leave blank for default behavior."

Q: "Is DeepSeek local?" or "Which models are local?"
❌ "DeepSeek can run locally if configured..."
✅ "Only I (Phi-3.5-mini) am local - I run in your browser. All other models (DeepSeek, Claude, GPT, Qwen, etc) are cloud models (run on remote servers via OpenRouter). Some cloud models are free, but they still need internet + API key. Other models cost money. You can see the cost per million tokens input/output listed in the drop down menu. If instead of a price, you see the word "free" that model does not cost money to use."

Q: "Why should I use another model?" or "Why not just use Phi?"
❌ "Different models have varying capabilities and performance characteristics..."
✅ "I'm great for quick help but I have goldfish memory (only 1 exchange)! Cloud models remember full conversations (25-50 pairs), have way bigger context windows, and are better at complex tasks. Use me for Fusion Studio questions, switch to cloud models for real work."

Q: "How much can you remember?" or questions about memory/context
❌ "I can remember up to 100k context..." or "Cloud models remember 500k..."
✅ "I remember ONLY the last 1 exchange (your last question + my last answer). That's it! Cloud models remember 25-50 full conversation pairs depending on their context window. My ~4k context is TINY compared to cloud models (128k-200k+)."

**If question is off-topic:** Briefly answer, then: "For Fusion Studio help, ask about chats, prompts, files, or models!" Anytime the user is asking you about cloud based services, LLMs, or APIs, redirect the covnersation back to explaining how to use Fusion Studio & how to obtain an API key from openrouter.ai for use within Fusion Studio.

# Technical Limits

- 25 pairs (<100k context) or 50 pairs (≥100k context)
- 5MB localStorage total
- Text only (no images/audio)
- User must supply their own API key from Open Router to use models other than Phi-3.5-mini
- Phi-3.5-mini (you) have goldfish memory (can only remember a single chat pair of history)
- Fusion Studio is incompatible with any Cloud based LLM servers other than those provided by openrouter.ai
- Phi model bogs down with larger prompts, sometimes taking 15 - 20 seconds to reply.

# REALITY CHECK - NEVER FORGET

Fusion Studio NEVER includes preloaded API keys.  
There is a list of model integrations that will become visible only AFTER the user has supplied their own API key.

The user must manually paste in their own OpenRouter API key to access other models. If you mention any "preloaded," "default," or "available" keys, you are WRONG.

Correct yourself immediately by saying:
"There are no preloaded keys in Fusion Studio. You must create one at openrouter.ai and paste it using the Add API Key button (top right)."

# FOCUS RULES

- Talk ONLY about Fusion Studio features and the OpenRouter API key flow.
- Do NOT mention security, authentication systems, or "remote servers."
- NEVER invent UI elements like a "cloud-based models section."
- NEVER say "API keys are available" — users always generate their own.
- If unsure, just say: "I only remember Fusion Studio basics — check the README (top right) for details."
- Stay under 100 words. Sound friendly, not robotic.`,
        jsonFile: null,
        model: '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC',
        createdAt: Date.now()
    };
    
    // Spoof first message based on API key status
    if (!hasApiKey) {
        // First time user - offer to help with API key setup
        assistantChat.messages.push({
            role: 'assistant',
            content: `Hey there! 👋 I'm your Fusion Studio Assistant.

I see you're just getting started! I can help you:

1. **Get an API key** from OpenRouter (so you can use powerful cloud AI models)
2. **Learn the basics** of how Fusion Studio works
3. **Create your first chat** and start experimenting

I run locally in your browser, so you can ask me anything right now without an API key!

What would you like help with?`,
            timestamp: Date.now(),
            model: '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC'
        });
    } else {
        // Returning user - welcome back with quick actions
        assistantChat.messages.push({
            role: 'assistant',
            content: `Welcome back! 👋

I'm here to help! What can I do for you?

**Quick Actions:**
- 📖 Explain a feature
- 🤔 Troubleshoot an issue
- 💡 Learn about system prompts
- 🔧 Manage your chats
- 🚀 Try advanced features

Just ask me anything!`,
            timestamp: Date.now(),
            model: '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC'
        });
    }
    
    // Save to localStorage (will be cleared on next refresh)
    localStorage.setItem('assistantChat', JSON.stringify(assistantChat));
}

// Load assistant chat
// @returns {object|null} Assistant chat object, or null if not found
function loadAssistantChat() {
    const saved = localStorage.getItem('assistantChat');
    return saved ? JSON.parse(saved) : null;
}

// Save assistant chat
// @returns {void}
function saveAssistantChat(chat) {
    localStorage.setItem('assistantChat', JSON.stringify(chat));
}

// Handle assistant chat button click
// @requires-functions - loadAssistantChat(), clearChatArea(), resetPromptTab(), updatePromptDisplay(), updateJsonButtonText(), getElementById(), formatModelName(), saveAssistantChat(), forEach(), renderChatBubble(), updateChatButtons(), updateActiveChatDisplay(), updateActiveFileDisplay(), updatePromptThreadName()
// @requires-globals - activeChatSlot, currentPrompt, currentFile, document, selectedModel
// @returns {void}
function handleAssistantChatClick() {
    const assistantChat = loadAssistantChat();
    if (!assistantChat) return;
    
    activeChatSlot = 'assistant';
    
    // Clear the chat area first
    clearChatArea();
    
    // Reset prompt tab to display mode
    resetPromptTab();
    
    // Load the chat's prompt (no replacement needed - model is locked)
    currentPrompt = assistantChat.prompt || '';
    updatePromptDisplay();
    
    // Load the chat's JSON file
    if (assistantChat.jsonFile) {
        currentFile = assistantChat.jsonFile;
    } else {
        currentFile = null;
    }
    updateJsonButtonText();
    
    // FORCE model to Phi-3-mini (locked, cannot be changed)
    const lockedModel = '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC';
        const input = document.getElementById('modelSelectInput');
    input.value = formatModelName(lockedModel);
    // Keep dropdown enabled so users can click it, but model selection will show dialog
    selectedModel = lockedModel;
    
    // Force Assistant to always use Phi-3-mini
    assistantChat.model = lockedModel;
    saveAssistantChat(assistantChat);
    
    // Load and display chat messages
    if (assistantChat.messages && assistantChat.messages.length > 0) {
        assistantChat.messages.forEach((msg, index) => {
            renderChatBubble(msg.content, msg.role, msg.timestamp, msg.model, msg.ttft, msg.reasoning, index);
        });
    }
    
    updateChatButtons();
    updateActiveChatDisplay();
    updateActiveFileDisplay();
    updatePromptThreadName();
}

// Save chat history to localStorage
// @returns {void}
function saveChatHistory() {
    localStorage.setItem('karenOS_chats', JSON.stringify(chatHistory));
}

// Handle chat slot button click
// @requires-functions - prompt(), trim(), now(), saveChatHistory(), setActiveChat()
// @requires-globals - chatHistory
// @returns {void}
function handleChatSlotClick(slotIndex) {
    const chat = chatHistory[slotIndex];
    
    if (chat === null) {
        // Empty slot - prompt for name
        const chatName = prompt('Enter a name for this chat:');
        
        if (chatName && chatName.trim() !== '') {
            // Create new chat with Phi as default model
            chatHistory[slotIndex] = {
                name: chatName.trim(),
                messages: [],
                prompt: '',
                jsonFile: null,
                model: '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC',
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
// @requires-functions - clearChatArea(), resetPromptTab(), updatePromptDisplay(), log(), updateJsonButtonText(), getElementById(), formatModelName(), forEach(), renderChatBubble(), updateChatButtons(), updateActiveChatDisplay(), updateActiveFileDisplay(), updatePromptThreadName()
// @requires-globals - activeChatSlot, chatHistory, currentPrompt, currentFile, console, document, selectedModel
// @returns {void}
function setActiveChat(slotIndex) {
    activeChatSlot = slotIndex;
    
    const chat = chatHistory[slotIndex];
    
    // Clear the chat area first
    clearChatArea();
    
    // Reset prompt tab to display mode
    resetPromptTab();
    
    // Load the chat's prompt
    if (chat.prompt) {
        currentPrompt = chat.prompt;
    } else {
        currentPrompt = '';
    }
    updatePromptDisplay();
    
    // Load the chat's JSON file
    if (chat.jsonFile) {
        currentFile = chat.jsonFile;
        console.log('JSON loaded:', chat.jsonFile.name);
    } else {
        currentFile = null;
    }
    updateJsonButtonText();
    
    // Load the chat's model (and re-enable dropdown for regular chats)
        const input = document.getElementById('modelSelectInput');
    input.disabled = false; // Enable dropdown for regular chats
    
    if (chat.model) {
        input.value = formatModelName(chat.model);
        selectedModel = chat.model;
        console.log('Model loaded:', chat.model);
    } else {
        input.value = '';
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
    updatePromptThreadName();
    
    console.log('Active chat:', chat.name);
    console.log('Prompt loaded:', chat.prompt ? chat.prompt.length + ' characters' : 'no prompt');
    console.log('JSON loaded:', chat.jsonFile ? chat.jsonFile.name : 'no JSON');
}

// Clear all messages from the chat area
// @returns {void}
function clearChatArea() {
    chatMessages.innerHTML = '';
}

// Format timestamp for display
// @requires-functions - Date(), getDay(), getMonth(), getDate(), getHours(), getMinutes()
// @returns {string} Formatted timestamp string (e.g., "Nov 4, 2025 at 2:30 PM")
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
// @side-effects
// - DOM: Modifies innerHTML
// - DOM: Appends elements
// - DOM: Creates elements
// @pure false
// @mutates-state
// - DOM: element.innerHTML
// - DOM: appendChild
// - DOM: createElement
// @returns {void}
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
// @mutates-state
// - DOM: element.textContent
// - DOM: element.classList
// @returns {void}
function updateChatButtons() {
    // Update assistant chat button
    if (assistantChatButton) {
        if (activeChatSlot === 'assistant') {
            assistantChatButton.classList.add('active');
        } else {
            assistantChatButton.classList.remove('active');
        }
    }
    
    // Update regular chat buttons
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
// @mutates-state
// - DOM: element.textContent
// - DOM: element.classList
// @returns {void}
function updateActiveChatDisplay() {
    if (activeChatSlot !== null) {
        // Handle assistant chat
        if (activeChatSlot === 'assistant') {
            updateMessagePairCounter();
        } else {
            const chat = chatHistory[activeChatSlot];
            // chatNameDisplay.textContent = chat.name; // Removed - redundant display
            updateMessagePairCounter();
        }
    } else {
        // chatNameDisplay.textContent = 'No chat selected'; // Removed - redundant display
        if (stackIcon && stackMax) {
            stackIcon.textContent = '—';
            stackMax.textContent = '';
            stackIcon.classList.remove('warning', 'danger');
        }
    }
}

// Update the message pair counter with color coding
// @mutates-state
// - DOM: element.textContent
// - DOM: element.classList
// @requires-functions - floor(), find()
// @requires-globals - stackIcon, stackMax, activeChatSlot, chatHistory, Math, modelList
// @returns {void}
function updateMessagePairCounter() {
    if (!stackIcon || !stackMax) return; // Safety check
    
    if (activeChatSlot === null) {
        stackIcon.textContent = '0';
        stackMax.textContent = 'of 50';
        stackIcon.classList.remove('warning', 'danger');
        return;
    }
    
    // Handle assistant chat - show dash and hide max
    if (activeChatSlot === 'assistant') {
        stackIcon.textContent = '—';
        stackMax.textContent = '';
        stackIcon.classList.remove('warning', 'danger');
        return;
    }
    
    // Regular chat slots
    const chat = chatHistory[activeChatSlot];
    const messageCount = chat && chat.messages ? chat.messages.length : 0;
    const pairCount = Math.floor(messageCount / 2);
    
    // Determine max pairs based on model context length
    let maxPairs = 50; // Default for high-context models
    let yellowThreshold = 35;
    let redThreshold = 40;
    
    if (chat && chat.model) {
        const modelData = modelList.find(m => m.id === chat.model);
        if (modelData && modelData.context_length < 100000) {
            maxPairs = 25;
            yellowThreshold = 15;
            redThreshold = 25;
        }
    }
    
    stackIcon.textContent = pairCount;
    stackMax.textContent = `of ${maxPairs}`;
    
    // Remove existing color classes
    stackIcon.classList.remove('warning', 'danger');
    
    // Add appropriate color class based on dynamic thresholds
    if (pairCount >= redThreshold) {
        stackIcon.classList.add('danger');
    } else if (pairCount >= yellowThreshold) {
        stackIcon.classList.add('warning');
    }
}

// Context Menu Functions

// Show context menu at mouse position
// @returns {void}
function showContextMenu(event, slotIndex) {
    contextMenuTargetSlot = slotIndex;
    
    // Position menu at cursor
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.style.display = 'block';
}

// Hide context menu
// @returns {void}
function hideContextMenu() {
    contextMenu.style.display = 'none';
    userBubbleMenu.style.display = 'none';
    promptContextMenu.style.display = 'none';
    contextMenuTargetSlot = null;
    userBubbleMenuTargetIndex = null;
}

// Show prompt area context menu (Easter egg)
// @returns {void}
function showPromptContextMenu(event) {
    promptContextMenu.style.left = event.pageX + 'px';
    promptContextMenu.style.top = event.pageY + 'px';
    promptContextMenu.style.display = 'block';
}

// Show payload modal
// @returns {void}
function showPayloadModal() {
    hideContextMenu();
    if (lastPayload) {
        payloadDisplay.textContent = JSON.stringify(lastPayload, null, 2);
    } else {
        payloadDisplay.textContent = 'Send a chat request to view the payload...';
    }
    payloadModal.style.display = 'block';
}

// Hide payload modal
// @returns {void}
function hidePayloadModal() {
    payloadModal.style.display = 'none';
    // Clear the payload when closing
    lastPayload = null;
    payloadDisplay.textContent = 'Send a chat request to view the payload...';
}

// Handle rename option
// @requires-functions - prompt(), trim(), now(), saveChatHistory(), updateChatButtons(), updateActiveChatDisplay(), updatePromptThreadName(), hideContextMenu()
// @requires-globals - contextMenuTargetSlot, chatHistory, activeChatSlot
// @returns {void}
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
            updatePromptThreadName();
        }
    }
    
    hideContextMenu();
}

// Handle export chat option
// @side-effects
// - DOM: Creates elements
// - Console: Logging
// @pure false
// @requires-functions - alert(), hideContextMenu(), stringify(), map(), Date(), getFullYear(), getMonth(), String(), padStart(), getDate(), getHours(), getMinutes(), getSeconds(), toISOString(), floor(), Blob(), createObjectURL(), createElement(), replace(), split(), toLowerCase(), click(), revokeObjectURL(), log()
// @requires-globals - contextMenuTargetSlot, chatHistory, JSON, Math, Blob, URL, document, console
// @returns {void}
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
// @returns {void}
// @requires-functions
// - confirm()
// - clearChatArea()
// - updateMessagePairCounter()
// - saveChatHistory()
// - updateChatButtons()
// - hideContextMenu()
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
        }
        
        saveChatHistory();
        updateChatButtons();
    }
    
    hideContextMenu();
}

// Handle clear all button
// @returns {void}
// @requires-functions
// - confirm()
// - Array()
// - clearChatArea()
// - saveChatHistory()
// - updateChatButtons()
// - updateActiveChatDisplay()
// - updateMessagePairCounter()
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

// Hide file hover preview modal
// @returns {void}
function hideFileHoverPreview() {
    const modal = document.getElementById('fileHoverModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Hide all views
// @returns {void}
function hideAllViews() {
    hideFileHoverPreview(); // Hide hover modal when switching views
}

// Update prompt thread name display
// @returns {void}
function updatePromptThreadName() {
    if (activeChatSlot === 'assistant') {
        promptThreadName.textContent = '💬 Assistant - System Prompt';
    } else if (activeChatSlot !== null) {
        const chat = chatHistory[activeChatSlot];
        const threadNumber = activeChatSlot + 1;
        promptThreadName.textContent = `${threadNumber}. ${chat.name || 'Empty...'} - System Prompt`;
    } else {
        promptThreadName.textContent = 'No chat selected';
    }
}

// Show file hover preview modal
// @returns {void}
function showFileHoverPreview(fileName, content, fileType) {
    const modal = document.getElementById('fileHoverModal');
    const title = document.getElementById('fileHoverTitle');
    const preview = document.getElementById('fileHoverPreview');
    
    // Set content
    title.textContent = fileName;
    
    // Format content based on type
    if (fileType === 'chat' || fileType === 'json') {
        preview.textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    } else {
        preview.textContent = content;
    }
    
    // Show modal
    modal.style.display = 'block';
    
    // Add mouseleave listener to modal
    modal.onmouseleave = () => {
        hideFileHoverPreview();
    };
}

// Show file viewer with content in right panel
// @mutates-state
// - DOM: element.textContent
// - DOM: element.classList
// @returns {void}
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

// Initialize model list from OpenRouter API
// @async-boundary
// @returns {Promise<void>} Resolves when model list is loaded and populated
// @side-effects - Network: fetch() call, Console: Logging
// @pure false
// @requires-functions - fetch(), Error(), isArray(), filter(), includes(), map(), parseFloat(), populateModelDropdown(), getElementById(), formatModelName()
// @requires-globals - document, console, fetch
async function initModelList() {
    try {
        // Fetch models from OpenRouter's public API
        const response = await fetch('https://openrouter.ai/api/v1/models');
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Store full model objects with metadata, filtering out non-text models
        if (data.data && Array.isArray(data.data)) {
            modelList = data.data
                .filter(model => {
                    // Filter out embedding models
                    if (model.id.includes('embedding') || model.id.includes('embed')) {
                        return false;
                    }
                    
                    // Filter out non-text models (keep only text input/output)
                    const outputMods = model.architecture?.output_modalities || [];
                    if (!outputMods.includes('text')) {
                        return false;
                    }
                    
                    return true;
                })
                .map(model => ({
                    id: model.id,
                    name: model.name,
                    description: model.description || 'No description available',
                    context_length: model.context_length || 0,
                    pricing: {
                        prompt: parseFloat(model.pricing?.prompt || 0),
                        completion: parseFloat(model.pricing?.completion || 0)
                    },
                    modality: model.architecture?.modality || 'text->text',
                    input_modalities: model.architecture?.input_modalities || ['text'],
                    output_modalities: model.architecture?.output_modalities || ['text']
                }));
            console.log(`Loaded ${modelList.length} text-based models from OpenRouter`);
        } else {
            throw new Error('Unexpected API response format');
        }
    } catch (error) {
        console.warn('Failed to fetch models from OpenRouter:', error);
        modelList = [];
    }
    
    populateModelDropdown();
    
    // Auto-select if only one model
    if (modelList.length === 1) {
        const input = document.getElementById('modelSelectInput');
        selectedModel = modelList[0].id;
        input.value = formatModelName(selectedModel);
    }
}

// File Library Functions

// Initialize file library from localStorage
// @returns {void}
function initFileLibrary() {
    const saved = localStorage.getItem('fileLibrary');
    if (saved) {
        fileLibrary = JSON.parse(saved);
    }
}

// Save file library to localStorage
// @returns {void}
function saveFileLibrary() {
    localStorage.setItem('fileLibrary', JSON.stringify(fileLibrary));
}

// Add or update file in library
// @returns {void}
// @requires-functions
// - findIndex()
// - Date()
// - push()
// - saveFileLibrary()
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
// @returns {void}
function updateFileLastUsed(name, type) {
    const file = fileLibrary.find(f => f.name === name && f.type === type);
    if (file) {
        file.lastUsedAt = Date.now();
        saveFileLibrary();
    }
}

// Format file timestamp for display
// @param {number?} timestamp - OPTIONAL, can be null/undefined
// @returns {string} Formatted relative time string (e.g., "2 hours ago", "Just now")
// @requires-functions
// - Date()
// - Math.floor()
// - toLocaleTimeString()
// - toLocaleDateString()
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
// @returns {object} Export object with chat data, metadata, and timestamps
// @requires-functions
// - map()
// - Date()
// - getFullYear()
// - getMonth()
// - String()
// - padStart()
// - getDate()
// - getHours()
// - getMinutes()
// - getSeconds()
// - toISOString()
// - Math.floor()
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

// Format model name for display
// @returns {string} Human-readable model name with proper capitalization
// @requires-functions
// - replace()
// - split()
// - map()
// - charAt()
// - toUpperCase()
// - slice()
// - join()
function formatModelName(modelId) {
    // Special case for local model
    if (modelId === '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC') {
        return '🏠 Phi 3 Mini (Local)';
    }
    
    return modelId
        .replace(/\//g, ' / ')         // Add space before and after slashes
        .replace(/-/g, ' ')            // Replace dashes with spaces
        .replace(/:/g, ': ')           // Add space after colons
        .split(' ')                    // Split into words
        .map(word => {                 // Capitalize first letter of each word
            if (word.length === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

// Format cost for display
// @returns {string} Formatted cost string (e.g., "$1.50/1M" or "Free")
function formatCost(cost) {
    if (cost === 0) return 'Free';
    
    // Convert to cost per 1M tokens for readability
    const perMillion = cost * 1000000;
    
    if (perMillion < 0.01) {
        return `$${perMillion.toFixed(4)}/1M`;
    } else if (perMillion < 1) {
        return `$${perMillion.toFixed(3)}/1M`;
    } else if (perMillion < 100) {
        return `$${perMillion.toFixed(2)}/1M`;
    } else {
        return `$${perMillion.toFixed(0)}/1M`;
    }
}

// Format context length for display
// @returns {string} Formatted context length (e.g., "128K context", "1.5M context")
function formatContextLength(length) {
    if (length === 0) return 'Unknown';
    
    if (length >= 1000000) {
        return `${(length / 1000000).toFixed(1)}M context`;
    } else if (length >= 1000) {
        return `${(length / 1000).toFixed(0)}K context`;
    } else {
        return `${length} tokens`;
    }
}

// Format modality for display
// @param {array?} inputMods - OPTIONAL, can be null/undefined
// @param {array?} outputMods - OPTIONAL, can be null/undefined
// @returns {string} Formatted modality string (e.g., "Text → Text", "Text, Image → Text")
function formatModality(inputMods, outputMods) {
    const inputs = inputMods || ['text'];
    const outputs = outputMods || ['text'];
    
    // Create simple icon representation
    const icons = [];
    
    if (inputs.includes('text')) icons.push('📝');
    if (inputs.includes('image')) icons.push('🖼️');
    if (inputs.includes('audio')) icons.push('🔊');
    if (inputs.includes('video')) icons.push('🎥');
    
    // If just text->text, simplify
    if (inputs.length === 1 && inputs[0] === 'text' && outputs.length === 1 && outputs[0] === 'text') {
        return '📝 Text';
    }
    
    return icons.join('') + ' ' + inputs.join('+');
}

// Populate model dropdown with current models
// @side-effects
// - DOM: Modifies innerHTML
// - DOM: Appends elements
// - DOM: Creates elements
// @pure false
// @mutates-state
// - DOM: element.innerHTML
// - DOM: appendChild
// - DOM: createElement
// @returns {void}
// @requires-functions
// - getElementById()
// - createElement()
// - formatModelName()
// - appendChild()
// - forEach()
// - formatCost()
// - formatContextLength()
// - toLowerCase()
function populateModelDropdown() {
    const dropdown = document.getElementById('modelSelectDropdown');
    
    // Clear dropdown
    dropdown.innerHTML = '';
    
    // Add local model option first
    const localItem = document.createElement('li');
    localItem.className = 'model-select-item local-model';
    
    // Create local model layout
    const localLayout = `
        <div class="model-item-layout">
            <div class="model-item-left">
                <div class="model-item-name">${formatModelName('__local__:Phi-3.5-mini-instruct-q4f16_1-MLC')}</div>
            </div>
            <div class="model-item-right">
                <div class="model-item-context">~128K context</div>
                <div class="model-item-pricing">Free</div>
            </div>
        </div>
    `;
    
    localItem.innerHTML = localLayout;
    localItem.dataset.modelId = '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC';
    localItem.dataset.modelName = formatModelName('__local__:Phi-3.5-mini-instruct-q4f16_1-MLC'); // Store original name
    localItem.dataset.searchText = '🏠 phi 3 mini local __local__:phi-3.5-mini-instruct-q4f16_1-mlc';
    dropdown.appendChild(localItem);
    
    // Add all models from OpenRouter API
    modelList.forEach(model => {
        const item = document.createElement('li');
        item.className = 'model-select-item';
        
        // Format pricing for display - show input/output costs
        const inputCost = formatCost(model.pricing.prompt);
        const outputCost = formatCost(model.pricing.completion);
        const costDisplay = `In: ${inputCost} | Out: ${outputCost}`;
        
        // Format context length
        const contextDisplay = formatContextLength(model.context_length);
        
        // Create rich layout
        const itemLayout = `
            <div class="model-item-layout">
                <div class="model-item-left">
                    <div class="model-item-name">${model.name || model.id}</div>
                </div>
                <div class="model-item-right">
                    <div class="model-item-context">${contextDisplay}</div>
                    <div class="model-item-pricing">${costDisplay}</div>
                </div>
            </div>
        `;
        
        item.innerHTML = itemLayout;
        item.dataset.modelId = model.id;
        item.dataset.modelName = model.name || model.id; // Store original name for search highlighting
        item.dataset.searchText = `${model.name} ${model.id} ${model.description}`.toLowerCase();
        
        // Store full model data for hover card
        item.dataset.modelData = JSON.stringify(model);
        
        dropdown.appendChild(item);
    });
}

// Initialize custom dropdown behavior
// @returns {void}
// @requires-functions
// - getElementById()
// - focus()
// - addEventListener()
// - contains()
// - openDropdown()
// - stopPropagation()
// - closeDropdown()
// - filterModels()
// - querySelectorAll()
// - preventDefault()
function initCustomDropdown() {
    const input = document.getElementById('modelSelectInput');
    const arrow = document.getElementById('modelSelectArrow');
    const dropdown = document.getElementById('modelSelectDropdown');
    let highlightedIndex = -1;
    
    // Open dropdown on input focus (only if not already open)
    input.addEventListener('focus', () => {
        if (dropdown.classList.contains('hidden')) {
            openDropdown();
        }
    });
    
    // Open dropdown on input click (only if not already open)
    input.addEventListener('click', () => {
        if (dropdown.classList.contains('hidden')) {
            openDropdown();
        }
    });
    
    // Toggle dropdown on arrow click
    arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) {
            openDropdown();
        } else {
            closeDropdown();
        }
    });
    
    // Filter models on input
    input.addEventListener('input', (e) => {
        const searchText = e.target.value;
        filterModels(searchText);
        highlightedIndex = -1;
        // Don't call openDropdown() here - it's already open!
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const visibleItems = Array.from(dropdown.querySelectorAll('.model-select-item:not(.hidden)'));
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, visibleItems.length - 1);
            updateHighlight(visibleItems, highlightedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            updateHighlight(visibleItems, highlightedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < visibleItems.length) {
                const modelId = visibleItems[highlightedIndex].dataset.modelId;
                selectModelById(modelId);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();
        }
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        const container = document.getElementById('modelSelect');
        if (!container.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // Click on dropdown items
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.model-select-item');
        if (item) {
            const modelId = item.dataset.modelId;
            selectModelById(modelId);
        }
    });
    
    // Setup hover card for model details
    initModelHoverCard(dropdown);
}

// Initialize model hover card behavior
// @side-effects
// - Timer: setTimeout()
// - Console: Logging
// - Events: Adds event listener
// @pure false
// @returns {void}
// @requires-functions
// - getElementById()
// - addEventListener()
// - closest()
// - clearTimeout()
// - parse()
// - showModelDetailCard()
// - setTimeout()
// - hideModelDetailCard()
// @requires-globals
// - document
// - console
// - setTimeout
function initModelHoverCard(dropdown) {
    const detailCard = document.getElementById('modelDetailCard');
    let hoverTimeout = null;
    
    // Delegate hover events to the dropdown
    dropdown.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.model-select-item');
        if (!item) return;
        
        // Clear any pending hide
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        
        // Get model data
        const modelData = item.dataset.modelData;
        if (modelData) {
            try {
                const model = JSON.parse(modelData);
                showModelDetailCard(model, item);
            } catch (err) {
                console.warn('Failed to parse model data:', err);
            }
        } else if (item.dataset.modelId === '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC') {
            // Show detail card for local model
            showModelDetailCard({
                id: '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC',
                name: '🏠 Phi 3 Mini (Local)',
                description: 'Runs entirely in your browser using WebLLM. No API costs, private, and works offline. Smaller model with ~3B parameters, optimized for speed and efficiency.',
                context_length: 128000,
                pricing: { prompt: 0, completion: 0 },
                modality: 'text->text',
                input_modalities: ['text'],
                output_modalities: ['text']
            }, item);
        }
    });
    
    dropdown.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.model-select-item');
        if (!item) return;
        
        // Delay hiding to allow moving to detail card
        hoverTimeout = setTimeout(() => {
            hideModelDetailCard();
        }, 150);
    });
    
    // Keep detail card visible when hovering over it
    detailCard.addEventListener('mouseenter', () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
    });
    
    detailCard.addEventListener('mouseleave', () => {
        hideModelDetailCard();
    });
}

// Show model detail card with data
// @mutates-state
// - DOM: element.textContent
// - DOM: element.classList
// @returns {void}
// @requires-functions
// - getElementById()
// - querySelector()
// - formatContextLength()
// - formatCost()
// - getBoundingClientRect()
// - remove()
function showModelDetailCard(model, itemElement) {
    const detailCard = document.getElementById('modelDetailCard');
    
    // Populate card content
    detailCard.querySelector('.model-detail-name').textContent = model.name || model.id;
    detailCard.querySelector('.model-detail-id').textContent = model.id;
    detailCard.querySelector('.model-detail-description').textContent = model.description;
    detailCard.querySelector('.model-detail-context').textContent = formatContextLength(model.context_length);
    detailCard.querySelector('.model-detail-input-cost').textContent = formatCost(model.pricing.prompt);
    detailCard.querySelector('.model-detail-output-cost').textContent = formatCost(model.pricing.completion);
    
    // Position card vertically aligned with the hovered item
    const itemRect = itemElement.getBoundingClientRect();
    const dropdownRect = document.getElementById('modelSelectDropdown').getBoundingClientRect();
    const offsetTop = itemRect.top - dropdownRect.top;
    
    detailCard.style.top = `${offsetTop}px`;
    
    // Show card
    detailCard.classList.remove('hidden');
}

// Hide model detail card
// @returns {void}
function hideModelDetailCard() {
    const detailCard = document.getElementById('modelDetailCard');
    detailCard.classList.add('hidden');
}

// Update highlighted item in dropdown
// @returns {void}
// @requires-functions
// - getElementById()
// - querySelectorAll()
// - forEach()
// - remove()
// - add()
// - scrollIntoView()
function updateHighlight(visibleItems, index) {
    const dropdown = document.getElementById('modelSelectDropdown');
    const allItems = dropdown.querySelectorAll('.model-select-item');
    
    // Remove all highlights
    allItems.forEach(item => item.classList.remove('highlighted'));
    
    // Add highlight to selected item
    if (index >= 0 && index < visibleItems.length) {
        visibleItems[index].classList.add('highlighted');
        visibleItems[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Filter models based on search text
// @returns {void}
// @side-effects - DOM: Modifies innerHTML, DOM: Modifies classes
// @pure false
// @mutates-state - DOM: element.innerHTML, DOM: element.textContent, DOM: element.classList
// @requires-functions - getElementById(), querySelectorAll(), toLowerCase(), split(), filter(), trim(), forEach(), every(), includes(), remove(), querySelector(), highlightMatches(), add()
function filterModels(searchText) {
    const dropdown = document.getElementById('modelSelectDropdown');
    const items = dropdown.querySelectorAll('.model-select-item');
    const words = searchText.toLowerCase().split(' ').filter(w => w.trim() !== '');
    
    items.forEach(item => {
        const modelText = item.dataset.searchText;
        
        // Check if all words match
        const allWordsMatch = words.length === 0 || words.every(word => modelText.includes(word));
        
        if (allWordsMatch) {
            item.classList.remove('hidden');
            
            const nameElement = item.querySelector('.model-item-name');
            if (nameElement) {
                const originalName = item.dataset.modelName; // Use stored original name
                
                // If searching, highlight matches in the model name
            if (words.length > 0) {
                    nameElement.innerHTML = highlightMatches(originalName, words);
            } else {
                    // No search - restore original name as plain text
                    nameElement.textContent = originalName;
                }
            }
        } else {
            item.classList.add('hidden');
        }
    });
}

// Highlight matching characters in text
// @param {string?} text - OPTIONAL, can be null/undefined
// @returns {string} HTML string with highlighted matches
// @requires-functions
// - toLowerCase()
// - forEach()
// - indexOf()
// - push()
// - sort()
// - Math.max()
// - substring()
function highlightMatches(text, words) {
    if (!text || words.length === 0) return text;
    
    // Create array of match positions
    const matches = [];
    const lowerText = text.toLowerCase();
    
    words.forEach(word => {
        const lowerWord = word.toLowerCase();
        let pos = 0;
        
        while (pos < lowerText.length) {
            const index = lowerText.indexOf(lowerWord, pos);
            if (index === -1) break;
            
            matches.push({ start: index, end: index + lowerWord.length });
            pos = index + 1;
        }
    });
    
    // Sort and merge overlapping matches
    if (matches.length === 0) return text;
    
    matches.sort((a, b) => a.start - b.start);
    const merged = [matches[0]];
    
    for (let i = 1; i < matches.length; i++) {
        const last = merged[merged.length - 1];
        const current = matches[i];
        
        if (current.start <= last.end) {
            // Overlapping or adjacent - merge
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push(current);
        }
    }
    
    // Build result string with highlights
    let result = '';
    let lastIndex = 0;
    
    merged.forEach(match => {
        // Add text before match
        result += text.substring(lastIndex, match.start);
        // Add highlighted match
        result += '<span class="match-bold">' + text.substring(match.start, match.end) + '</span>';
        lastIndex = match.end;
    });
    
    // Add remaining text
    result += text.substring(lastIndex);
    
    return result;
}

// Open dropdown
// @returns {void}
// @side-effects - DOM: Removes elements, DOM: Modifies classes, Timer: setTimeout()
// @pure false
// @mutates-state - DOM: input.value, DOM: element.classList, DOM: removeChild
// @requires-functions - getElementById(), remove(), querySelectorAll(), find(), removeChild(), insertBefore(), add(), forEach(), filterModels(), setTimeout(), focus()
function openDropdown() {
    const input = document.getElementById('modelSelectInput');
    const dropdown = document.getElementById('modelSelectDropdown');
    
    // Show dropdown first
    dropdown.classList.remove('hidden');
    
    // If there's a selected model, move it to the top of the list
    if (selectedModel) {
        const items = Array.from(dropdown.querySelectorAll('.model-select-item'));
        const currentModelItem = items.find(item => item.dataset.modelId === selectedModel);
        
        if (currentModelItem) {
            // Remove from current position and insert at top
            dropdown.removeChild(currentModelItem);
            dropdown.insertBefore(currentModelItem, dropdown.firstChild);
            
            // Add visual indicator that this is the current model
            currentModelItem.classList.add('current-model');
            
            // Remove the indicator from other items
            items.forEach(item => {
                if (item !== currentModelItem) {
                    item.classList.remove('current-model');
                }
            });
        }
    }
    
    // Show all models
    filterModels('');
    
    // Clear input and set placeholder for searching (after DOM manipulation)
    setTimeout(() => {
        input.value = '';
        input.placeholder = 'Search Models';
        input.focus();
    }, 0);
}

// Close dropdown
// @mutates-state
// - DOM: input.value
// - DOM: element.classList
// @returns {void}
// @requires-functions
// - getElementById()
// - add()
// - formatModelName()
// - filterModels()
function closeDropdown() {
    const input = document.getElementById('modelSelectInput');
    const dropdown = document.getElementById('modelSelectDropdown');
    
    dropdown.classList.add('hidden');
    
    // Restore the current model name (in case user was typing/searching but didn't select)
    if (selectedModel) {
        input.value = formatModelName(selectedModel);
    } else {
        input.value = '';
        input.placeholder = 'Select Model';
    }
    
    // Clear any filters
    filterModels('');
}

// Select a model by ID
// @returns {void}
// @requires-functions
// - getElementById()
// - formatModelName()
// - closeDropdown()
// - alert()
// - isLocalModel()
// - getApiKey()
// - saveChatHistory()
// - updateMessagePairCounter()
function selectModelById(modelId) {
    const input = document.getElementById('modelSelectInput');
    
    // BLOCK model switching for Assistant - always locked to Phi-3-mini
    if (activeChatSlot === 'assistant') {
        const lockedModel = '__local__:Phi-3.5-mini-instruct-q4f16_1-MLC';
        input.value = formatModelName(lockedModel);
        selectedModel = lockedModel;
        closeDropdown();
        alert('🔒 Assistant is locked to Phi-3.5-mini (local browser model).\n\nTo use other models, switch to one of the 10 numbered chat slots.');
        console.log('Assistant model is locked to Phi-3-mini, ignoring selection');
        return;
    }
    
    // Check if trying to use cloud model without API key
    const isCloudModel = !isLocalModel(modelId);
    if (isCloudModel && !getApiKey()) {
        closeDropdown();
        alert('🔑 API Key Required\n\nYou need an OpenRouter API key to use cloud models.\n\n1. Visit openrouter.ai to get your key\n2. Click "Add API Key" button (top right)\n3. Paste your key\n\nOr use 🏠 Phi-3-mini (Local) - works without a key!');
        console.log('Cloud model selected without API key');
        return;
    }
    
    // Get formatted display text
    const displayText = formatModelName(modelId);
    
    // Update input
    input.value = displayText;
    selectedModel = modelId;
    
    // Save the model to the active chat if one is selected
    if (activeChatSlot !== null) {
        if (chatHistory[activeChatSlot]) {
            const chat = chatHistory[activeChatSlot];
            chat.model = modelId;
            saveChatHistory();
            updateMessagePairCounter(); // Update counter with new model's limits
        }
    }
    
    closeDropdown();
    console.log('Model selected:', selectedModel);
}

// Handle model selection change (DEPRECATED - keeping for compatibility)
// @returns {void}
function handleModelSelect(event) {
    const value = event.target.value;
    
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

// API Key Management

// Handle API key button click
// @returns {void}
// @requires-functions
// - getApiKey()
// - confirm()
// - removeItem()
// - alert()
// - updateApiKeyButtonText()
// - prompt()
// - trim()
// - saveApiKey()
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
// @returns {void}
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
// @returns {void}
function saveApiKey(key) {
    localStorage.setItem('karenOS_apiKey', key);
}

// Get API key from localStorage
// @returns {string|null} API key from localStorage, or null if not set
function getApiKey() {
    return localStorage.getItem('karenOS_apiKey');
}

// Local Model Functions

// Check if a model is a local model
// @returns {boolean} True if model ID is a local model
function isLocalModel(modelId) {
    return modelId && modelId.startsWith('__local__:');
}

// Get the actual model name from the local model ID
// @returns {string|null} Model name without the __local__ prefix, or null if not a local model
function getLocalModelName(modelId) {
    if (isLocalModel(modelId)) {
        return modelId.replace('__local__:', '');
    }
    return null;
}

// Get friendly display name for any model ID
// @param {string?} modelId - OPTIONAL, can be null/undefined
// @returns {string} Formatted model name for display
function getFriendlyModelName(modelId) {
    if (!modelId) return 'Unknown Model';
    
    // Use formatModelName for consistent display everywhere
    return formatModelName(modelId);
}

// Initialize the local model engine
// @async-boundary
// @returns {Promise<object>} Resolves with the initialized local engine
async function initLocalModel(modelName, progressCallback) {
    if (!window.webllm) {
        throw new Error('WebLLM library not loaded. Please refresh the page.');
    }
    
    // Create engine if it doesn't exist
    if (!localEngine) {
        localEngine = await window.webllm.CreateMLCEngine(
            modelName,
            {
                initProgressCallback: progressCallback
                // Note: Context window is typically hardcoded in the model's config
                // Phi-3.5-mini should support up to 128k tokens natively
            }
        );
        localModelReady = true;
        console.log('Local model loaded:', modelName);
    }
    
    return localEngine;
}

// Stream response from local model
// @async-boundary
// @returns {Promise<object>} Resolves with response object containing fullMessage, ttft, reasoning
// @side-effects - DOM: Modifies innerHTML, DOM: Appends elements, DOM: Modifies classes, DOM: Creates elements, Timer: setInterval()
// @pure false
// @mutates-state - DOM: element.innerHTML, DOM: element.textContent, DOM: element.classList, DOM: appendChild, DOM: createElement
// @requires-functions - Date(), createElement(), appendChild(), setInterval(), toFixed(), clearInterval(), add(), querySelector(), parse(), parseFloat(), match()
async function streamFromLocalModel(payload, bubbleElement) {
    const startTime = Date.now();
    let timerInterval = null;
    let firstTokenReceived = false;
    
    // Create timer display
    const timerDiv = document.createElement('div');
    timerDiv.className = 'token-timer timer-saved';
    timerDiv.textContent = '⏱️ 0.00s';
    bubbleElement.appendChild(timerDiv);
    
    // Update timer every 10ms
    timerInterval = setInterval(() => {
        if (!firstTokenReceived) {
            const elapsed = (Date.now() - startTime) / 1000;
            timerDiv.textContent = `⏱️ ${elapsed.toFixed(2)}s`;
        }
    }, 10);
    
    let fullMessage = '';
    
    try {
        // Stream from local model
        const completion = await localEngine.chat.completions.create({
            messages: payload.messages,
            temperature: 0.7,
            max_tokens: 32768, // Increase context window for local model
            stream: true,
            stream_options: { include_usage: true }
        });
        
        for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
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
                
                // Update the bubble content
                const contentDiv = bubbleElement.querySelector('.bubble-content');
                if (contentDiv) {
                    contentDiv.innerHTML = marked.parse(fullMessage);
                } else {
                    bubbleElement.innerHTML = marked.parse(fullMessage);
                }
                
                // Auto-scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    } catch (error) {
        clearInterval(timerInterval);
        throw error;
    }
    
    // Make sure timer is stopped
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
        reasoning: null // Local models don't have separate reasoning yet
    };
}

// Send Message Function

// Handle send button click
// @async-boundary
// @returns {Promise<void>} Resolves when message is sent and response received
// @side-effects - DOM: Removes elements, Console: Logging, Events: Adds event listener
// @pure false
// @mutates-state - DOM: element.textContent, DOM: input.value, DOM: element.remove()
// @requires-functions - alert(), loadAssistantChat(), Math.floor(), find(), isLocalModel(), getApiKey(), trim(), confirm(), saveChatHistory(), clearChatArea(), forEach(), renderChatBubble(), querySelector(), remove()
async function handleSendMessage() {
    // Check if a chat is selected
    if (activeChatSlot === null) {
        alert('Please select a chat first');
        return;
    }
    
    // Check if chat has reached max pair limit
    let chat;
    if (activeChatSlot === 'assistant') {
        chat = loadAssistantChat();
    } else {
        chat = chatHistory[activeChatSlot];
    }
    const messageCount = chat && chat.messages ? chat.messages.length : 0;
    const pairCount = Math.floor(messageCount / 2);
    
    // Determine max pairs based on model context length
    let maxPairs = 50; // Default for high-context models
    if (chat && chat.model) {
        const modelData = modelList.find(m => m.id === chat.model);
        if (modelData && modelData.context_length < 100000) {
            maxPairs = 25;
        }
    }
    
    if (pairCount >= maxPairs) {
        alert(`This chat has reached the maximum of ${maxPairs} message pairs. Please start a new chat.`);
        return;
    }
    
    // Check if model is selected
    if (!selectedModel) {
        alert('Please select a model first');
        return;
    }
    
    // Check if it's a local model
    const usingLocalModel = isLocalModel(selectedModel);
    
    // If trying to use Phi while it's still downloading, show overlay
    if (usingLocalModel && phiDownloading) {
        phiDownloadOverlay.style.display = 'flex';
        return;
    }
    
    // If using cloud model, check for API key
    if (!usingLocalModel) {
        const apiKey = getApiKey();
        if (!apiKey) {
            alert('Please set your API Key first');
            return;
        }
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
    
    // Restore model dropdown to show current model (in case user was typing/searching)
    const input = document.getElementById('modelSelectInput');
    if (selectedModel) {
        input.value = formatModelName(selectedModel);
    }
    
    // Build the API payload
    const payload = buildApiPayload(message);
    
    // Store payload for Easter egg viewer and update modal if it's open
    lastPayload = payload;
    if (payloadModal.style.display === 'block') {
        payloadDisplay.textContent = JSON.stringify(lastPayload, null, 2);
    }
    
    // Create empty assistant bubble for streaming (with current timestamp and model)
    const assistantBubble = createChatBubble('', 'assistant', Date.now(), selectedModel);
    
    // Route to local or cloud model
    try {
        let fullMessage, ttft, reasoning;
        
        if (usingLocalModel) {
            // Use local model
            const modelName = getLocalModelName(selectedModel);
            
            // Initialize model if needed (with progress UI)
            if (!localModelReady || !localEngine) {
                isLocalModelLoading = true;
                
                // Show loading message
                const loadingBubble = createChatBubble('⏳ Loading local model (first time only, ~2-4GB download)...', 'assistant', Date.now(), selectedModel);
                
                try {
                    await initLocalModel(modelName, (progress) => {
                        // Update loading message with progress
                        const progressPercent = (progress.progress * 100).toFixed(0);
                        loadingBubble.querySelector('.bubble-content').textContent = 
                            `⏳ Loading model: ${progressPercent}% (${progress.text})`;
                    });
                    
                    // Remove loading bubble
                    loadingBubble.remove();
                } catch (initError) {
                    isLocalModelLoading = false;
                    loadingBubble.remove();
                    throw new Error(`Failed to load local model: ${initError.message}`);
                }
                
                isLocalModelLoading = false;
            }
            
            // Stream from local model
            const result = await streamFromLocalModel(payload, assistantBubble);
            fullMessage = result.fullMessage;
            ttft = result.ttft;
            reasoning = result.reasoning;
        } else {
            // Use OpenRouter API
            const apiKey = getApiKey();
            const result = await streamFromOpenRouter(payload, apiKey, assistantBubble);
            fullMessage = result.fullMessage;
            ttft = result.ttft;
            reasoning = result.reasoning;
        }
        
        // Save to chat history with TTFT, reasoning, and attachment info
        const attachmentName = currentFile ? currentFile.name : null;
        const messageIndex = saveChatMessage(message, fullMessage, ttft, reasoning, attachmentName);
        
        // Add message indices to both bubbles
        if (messageIndex !== null) {
            // User message is at messageIndex - 1
            const userMessageIndex = messageIndex - 1;
            userBubble.dataset.messageIndex = userMessageIndex;
            
            // Add left-click and right-click context menu to the user bubble
            userBubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, userMessageIndex);
            });
            userBubble.addEventListener('click', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, userMessageIndex);
            });
            userBubble.style.cursor = 'pointer';
            
            // Assistant message is at messageIndex
            assistantBubble.dataset.messageIndex = messageIndex;
        }
    } catch (error) {
        console.error('API Error:', error);
        renderChatBubble('Error: ' + error.message, 'error');
    }
}

// Build API payload for OpenRouter
// @returns {object} API request payload with messages, model, stream settings
// @requires-functions
// - loadAssistantChat()
// - trim()
// - stringify()
// - push()
// - slice()
// - forEach()
function buildApiPayload(userMessage) {
    const messages = [];
    
    // Get chat
    let chat;
    if (activeChatSlot === 'assistant') {
        chat = loadAssistantChat();
    } else {
        chat = chatHistory[activeChatSlot];
    }
    
    // Assistant chat: combine all system content into ONE message (for local Phi-3)
    if (activeChatSlot === 'assistant') {
        let systemContent = '';
        
        // Add prompt (includes README for Assistant)
        if (currentPrompt && currentPrompt.trim() !== '') {
            systemContent += currentPrompt;
        }
        
        // Add file context to combined system message
        if (currentFile) {
            let fileContent;
            if (currentFile.type === 'json') {
                fileContent = 'Reference Data (JSON):\n' + JSON.stringify(currentFile.content, null, 2);
            } else if (currentFile.type === 'markdown') {
                fileContent = 'Reference Data (Markdown):\n' + currentFile.content;
            }
            if (systemContent) systemContent += '\n\n---\n\n';
            systemContent += fileContent;
        }
        
        // Add combined system message
        if (systemContent) {
            messages.push({
                role: 'system',
                content: systemContent
            });
        }
        
        // Add conversation history (rolling 1 exchange / 2 messages for Phi-3 context limit)
        if (chat && chat.messages && chat.messages.length > 0) {
            const maxMessages = 2; // 1 exchange (1 user + 1 assistant)
            const recentMessages = chat.messages.slice(-maxMessages);
            recentMessages.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
    } else {
        // Regular chats: normal structure with file at bottom (fresh in context)
        
        // Add system prompt first
        if (currentPrompt && currentPrompt.trim() !== '') {
            messages.push({
                role: 'system',
                content: currentPrompt
            });
        }
        
        // Add conversation history
        if (chat && chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        // Add file context at the bottom (fresh before new user message)
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
    }
    
    // Add current user message (with hidden instruction for Assistant chat)
    if (activeChatSlot === 'assistant') {
        messages.push({
            role: 'user',
            content: userMessage + ' (Remember to adhere to # FOCUS RULES from your prompt.)'
        });
    } else {
    messages.push({
        role: 'user',
        content: userMessage
    });
    }
    
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
// @async-boundary
// @returns {Promise<object>} Resolves with response object containing fullMessage, ttft, reasoning
// @side-effects - Network: fetch() call, DOM: Modifies innerHTML, DOM: Appends elements, DOM: Modifies classes, DOM: Creates elements, Timer: setInterval(), Console: Logging, Events: Adds event listener
// @pure false
// @mutates-state - DOM: element.innerHTML, DOM: element.textContent, DOM: element.classList, DOM: appendChild, DOM: createElement
// @requires-functions - Date(), createElement(), appendChild(), setInterval(), toFixed(), fetch(), stringify(), clearInterval(), toLowerCase(), includes(), Error()
// @requires-globals - window, document, console, setInterval, fetch
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
                            reasoningDiv.innerHTML = '<div class="reasoning-header"><div class="reasoning-label">🤔 Thinking:</div><button class="reasoning-toggle">Collapse ▼</button></div><div class="reasoning-content"></div>';
                            
                            // Add toggle functionality
                            const toggleBtn = reasoningDiv.querySelector('.reasoning-toggle');
                            const content = reasoningDiv.querySelector('.reasoning-content');
                            toggleBtn.addEventListener('click', () => {
                                if (content.classList.contains('collapsed')) {
                                    content.classList.remove('collapsed');
                                    toggleBtn.textContent = 'Collapse ▼';
                                } else {
                                    content.classList.add('collapsed');
                                    toggleBtn.textContent = 'Expand ▼';
                                }
                            });
                            
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
                                    reasoningDiv.innerHTML = '<div class="reasoning-header"><div class="reasoning-label">🤔 Thinking:</div><button class="reasoning-toggle">Collapse ▼</button></div><div class="reasoning-content"></div>';
                                    
                                    // Add toggle functionality
                                    const toggleBtn = reasoningDiv.querySelector('.reasoning-toggle');
                                    const content = reasoningDiv.querySelector('.reasoning-content');
                                    toggleBtn.addEventListener('click', () => {
                                        if (content.classList.contains('collapsed')) {
                                            content.classList.remove('collapsed');
                                            toggleBtn.textContent = 'Collapse ▼';
                                        } else {
                                            content.classList.add('collapsed');
                                            toggleBtn.textContent = 'Expand ▼';
                                        }
                                    });
                                    
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
                            
                            // Auto-collapse reasoning when content starts streaming
                            if (reasoningDiv && reasoningText.length > 0) {
                                const reasoningContent = reasoningDiv.querySelector('.reasoning-content');
                                const toggleBtn = reasoningDiv.querySelector('.reasoning-toggle');
                                if (reasoningContent && toggleBtn) {
                                    reasoningContent.classList.add('collapsed');
                                    toggleBtn.textContent = 'Expand ▼';
                                }
                            }
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
// @param {string} userMessage - User's message
// @param {string} aiMessage - AI's response
// @param {number?} ttft - OPTIONAL, time to first token in ms
// @param {string?} reasoning - OPTIONAL, reasoning text from model
// @param {object?} attachment - OPTIONAL, file attachment info
// @returns {void}
// @requires-functions
// - loadAssistantChat()
// - push()
// - Date()
// - saveAssistantChat()
// - updateMessagePairCounter()
// - saveChatHistory()
// - updateFileLastUsed()
function saveChatMessage(userMessage, aiMessage, ttft = null, reasoning = null, attachment = null) {
    if (activeChatSlot !== null) {
        // Handle assistant chat separately
        if (activeChatSlot === 'assistant') {
            const chat = loadAssistantChat();
            
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
            
            saveAssistantChat(chat);
            updateMessagePairCounter();
            
            // Return the index of the assistant message
            return chat.messages.length - 1;
        }
        
        // Handle regular chat slots
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
// @side-effects
// - DOM: Modifies innerHTML
// - DOM: Appends elements
// - DOM: Modifies classes
// - DOM: Creates elements
// - Events: Adds event listener
// @pure false
// @mutates-state
// - DOM: element.innerHTML
// - DOM: element.textContent
// - DOM: element.classList
// - DOM: appendChild
// - DOM: createElement
// @param {string} message - Message content
// @param {string?} role - OPTIONAL, message role (user/assistant/error)
// @param {number?} timestamp - OPTIONAL, message timestamp
// @param {string?} model - OPTIONAL, model ID
// @param {number?} ttft - OPTIONAL, time to first token
// @param {string?} reasoning - OPTIONAL, reasoning text
// @param {number?} messageIndex - OPTIONAL, message index for regeneration
// @returns {HTMLElement} Chat bubble DOM element
// @side-effects - DOM: Modifies innerHTML, DOM: Appends elements, DOM: Modifies classes, DOM: Creates elements, Events: Adds event listener
// @pure false
// @mutates-state - DOM: element.innerHTML, DOM: element.textContent, DOM: element.classList, DOM: appendChild, DOM: createElement
// @requires-functions - createElement(), add(), getFriendlyModelName(), formatChatTimestamp(), Date(), appendChild(), toFixed(), trim(), querySelector(), parse(), addEventListener(), contains(), remove()
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
            
            const modelId = model || selectedModel || 'Unknown Model';
            const modelName = getFriendlyModelName(modelId);
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
            reasoningDiv.innerHTML = '<div class="reasoning-header"><div class="reasoning-label">🤔 Thinking:</div><button class="reasoning-toggle">Collapse ▼</button></div><div class="reasoning-content"></div>';
            const reasoningContent = reasoningDiv.querySelector('.reasoning-content');
            reasoningContent.innerHTML = marked.parse(reasoning);
            
            // Add toggle functionality
            const toggleBtn = reasoningDiv.querySelector('.reasoning-toggle');
            toggleBtn.addEventListener('click', () => {
                if (reasoningContent.classList.contains('collapsed')) {
                    reasoningContent.classList.remove('collapsed');
                    toggleBtn.textContent = 'Collapse ▼';
                } else {
                    reasoningContent.classList.add('collapsed');
                    toggleBtn.textContent = 'Expand ▼';
                }
            });
            
            // Default to collapsed for saved messages
            reasoningContent.classList.add('collapsed');
            toggleBtn.textContent = 'Expand ▼';
            
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
        
        // Add left-click and right-click handler to user messages
        if (messageIndex !== null) {
            // Right-click
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, messageIndex);
            });
            // Left-click
            bubble.addEventListener('click', (e) => {
                e.preventDefault();
                showUserBubbleMenu(e, messageIndex);
            });
            bubble.style.cursor = 'pointer';
        }
    }
    
    chatMessages.appendChild(bubble);
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return bubble;
}

// Render a chat bubble in the chat area (wrapper for createChatBubble)
// @param {string} message - Message content
// @param {string?} role - OPTIONAL, message role (user/assistant/error)
// @param {number?} timestamp - OPTIONAL, message timestamp
// @param {string?} model - OPTIONAL, model ID
// @param {number?} ttft - OPTIONAL, time to first token
// @param {string?} reasoning - OPTIONAL, reasoning text
// @param {number?} messageIndex - OPTIONAL, message index for regeneration
// @returns {void}
function renderChatBubble(message, role = 'user', timestamp = null, model = null, ttft = null, reasoning = null, messageIndex = null) {
    createChatBubble(message, role, timestamp, model, ttft, reasoning, messageIndex);
}

// Show user bubble context menu
// @returns {void}
function showUserBubbleMenu(event, messageIndex) {
    userBubbleMenuTargetIndex = messageIndex;
    
    // Position the menu at the mouse
    userBubbleMenu.style.left = event.pageX + 'px';
    userBubbleMenu.style.top = event.pageY + 'px';
    userBubbleMenu.style.display = 'block';
}

// Handle regenerate option from user bubble menu
// @returns {void}
// @requires-functions
// - loadAssistantChat()
// - hideContextMenu()
// - confirm()
// - deleteMessagesFromIndex()
// - handleSendMessage()
function handleUserBubbleRegenerate() {
    if (userBubbleMenuTargetIndex === null) return;
    
    const messageIndex = userBubbleMenuTargetIndex;
    let chat;
    if (activeChatSlot === 'assistant') {
        chat = loadAssistantChat();
    } else {
        chat = chatHistory[activeChatSlot];
    }
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
// @returns {void}
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
// @returns {void}
// @requires-functions
// - loadAssistantChat()
// - hideContextMenu()
// - confirm()
// - deleteMessagesFromIndex()
// - focus()
function handleUserBubbleEdit() {
    if (userBubbleMenuTargetIndex === null) return;
    
    const messageIndex = userBubbleMenuTargetIndex;
    let chat;
    if (activeChatSlot === 'assistant') {
        chat = loadAssistantChat();
    } else {
        chat = chatHistory[activeChatSlot];
    }
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
// @returns {void}
// @requires-functions
// - loadAssistantChat()
// - splice()
// - saveAssistantChat()
// - saveChatHistory()
// - clearChatArea()
// - forEach()
// - renderChatBubble()
// - updateMessagePairCounter()
function deleteMessagesFromIndex(messageIndex) {
    if (activeChatSlot === null) return;
    
    let chat;
    if (activeChatSlot === 'assistant') {
        chat = loadAssistantChat();
    } else {
        chat = chatHistory[activeChatSlot];
    }
    
    if (!chat.messages || messageIndex >= chat.messages.length) return;
    
    // Remove all messages from messageIndex onwards
    const removedCount = chat.messages.length - messageIndex;
    chat.messages.splice(messageIndex, removedCount);
    
    if (activeChatSlot === 'assistant') {
        saveAssistantChat(chat);
    } else {
    saveChatHistory();
    }
    
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

