# Fusion Studio

A lightweight chat interface for OpenRouter AI models. Manage up to 10 concurrent chat threads, load custom prompts, and integrate JSON data seamlessly.

---

## Getting Started

### How to Get an API Key from OpenRouter

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up or log in to your account
3. Navigate to your **Dashboard** or **API Keys** section
4. Click **Create API Key**
5. Give your key a name (e.g., "Fusion Studio")
6. Copy your new API key (it will look something like `sk-or-v1-...`)
7. Keep this key safe! You'll need it to use Fusion Studio

**Note:** OpenRouter requires credits to use. Make sure your account has a balance before making API calls.

---

### Setting Your API Key

1. Open Fusion Studio in your browser
2. Click the **Add API Key** button (located in the top header, to the right of the model selector)
3. Paste your OpenRouter API key into the prompt
4. Click **OK** or press Enter

Your API key is saved locally in your browser and will persist between sessions. The button will change to **Clear API Key** once a key is set.

**IMPORTANT: If your laptop is ever lost or stolen, IMMEDIATELY go to openrouter.ai and revoke your API key. You should also consider setting a spend limit as an extra layer of protection.**

![API Key Setup](images/image.png)

---

### Using the Assistant Chat

Fusion Studio includes a built-in **Assistant** that runs locally in your browser using the Phi-3-mini model. This means you can use it without an API key!

**The Assistant always loads when you open or refresh Fusion Studio.** This makes it easy to get help whenever you need it.

**To access the Assistant:**

1. Look at the **left panel** at the very top
2. Click the **💬 Assistant** button (or just refresh the page - it always defaults to Assistant)
3. Start asking questions about how to use Fusion Studio

The Assistant is perfect for:
- Learning how Fusion Studio works
- Getting help with features
- Understanding API keys and chat interfaces
- No API key required!

---

### Starting a Thread

Fusion Studio gives you **10 chat slots** so you can run multiple conversations at once.

**To start a new thread:**

1. Look at the **left panel** with numbered slots (1–10)
2. Click any slot that says **"Empty..."**
3. A prompt will appear asking you to **name your chat**
4. Type a name and click **OK**
5. The slot will now show your chat name

**To switch between threads:**
- Click any chat slot to switch to that conversation
- The active chat name appears at the top of the screen

**To manage a thread:**
- **Right-click** on any chat slot to open the context menu
- Choose from:
  - **Rename** – Change the chat name
  - **Export Chat** – Download the conversation as JSON
  - **Clear Data** – Delete all messages (keeps prompt, model, and JSON)

---

### Setting and Saving a Prompt

The **right panel** displays the system prompt for your currently selected chat. The prompt tells the AI how to behave, and it automatically updates whenever you switch between chat threads.

**At the top of the prompt area you'll see:**
- **Left side:** Thread name and number (e.g., "1. My Chat - System Prompt" or "💬 Assistant - System Prompt")
- **Right side:** Copy button (📋 icon) and Edit button

**To create or edit a prompt:**

1. Select a chat thread from the left panel
2. The right panel automatically shows that thread's prompt (or "No prompt loaded" if empty)
3. Click the **Edit** button in the upper right
4. Type your prompt directly in the text area, OR click **Add File** to load a `.md` (Markdown) file
5. Click **Save** when finished, or **Cancel** to discard changes

**To load a prompt from a file:**
- Click **Edit**, then **Add File** (appears while editing)
- Select a `.md` (Markdown) file from your computer
- The file contents will appear in the prompt text area
- Click **Save** to apply

**PLEASE NOTE: Each prompt is saved to its specific chat thread. When you switch threads, you'll see that thread's prompt. You'll need to set prompts individually for each chat you create.**

**Why use prompts?**
Prompts give the AI personality, instructions, or context. For example:
- "You are a helpful coding assistant."
- "Answer all questions in pirate speak."
- "You are an expert in JavaScript debugging."

---

### Adding a JSON or Markdown File

Fusion Studio lets you attach `.json` or `.md` files to your messages. This is useful for feeding data into the AI or working with structured information.

**To add a file:**

1. Click the **Add File** button (located in the input footer, bottom-left)
2. Select a `.json` or `.md` file from your computer
3. The filename will appear as a blue link where it said "No file loaded"
4. The button will change to **Remove File**
5. Type your message in the text area
6. Click **Send**

**What happens:**
- The file contents are included with your message
- The AI can read and work with the data
- The file stays loaded until you remove it or switch chats

**To preview a loaded file:**
- Hover your mouse over the blue filename link (bottom of chat area)
- A preview window will pop up showing the file contents

**To remove a file:**
- Click the **Remove File** button and confirm removal

---

### Managing Your Messages

You can edit, regenerate, or delete any of your previous messages using a context menu.

**To access message options:**

1. **Click or right-click** on any of your messages (user bubbles in the chat)
2. Choose from:
   - **Regenerate** – Deletes this message and everything after it, then resends the message
   - **Delete** – Deletes this message and everything after it permanently
   - **Edit** – Deletes this message and everything after, and places the text in the input field for editing

**Warning:** All three options will delete the selected message and ALL messages that came after it. This cannot be undone!

**Why use this?**
- Fix typos in past messages
- Try different phrasings to get better responses
- Remove unwanted conversation branches
- Start fresh from any point in the conversation

---

### Exporting Thread Data

You can export any chat thread as a JSON file to save your conversation history.

**To export a thread:**

1. **Right-click** on the chat slot you want to export
2. Select **Export Chat** from the context menu
3. A JSON file will download to your computer

**What's in the export?**
The JSON file contains:
- Chat name
- Selected model
- Full conversation history (all messages and responses)
- Timestamp of export

**Why export?**
- Backup important conversations
- Share conversations with others
- Analyze chat data programmatically
- Import into other tools

---

## Additional Features

### Model Selection
Choose from multiple AI models using the dropdown at the top (next to the chat name):
- **🏠 Phi-3-mini (Local)** – Runs in your browser, no API key needed!
- DeepSeek models (with extended reasoning)
- Qwen models  
- Inclusion AI models (Ling and Ring)
- Moonshot AI models
- Plus many more models from OpenRouter!

**How to use the model selector:**
- Click the dropdown to see all available models
- OR start typing to search/filter models in real-time
- **Pro tip:** Type "free" (space) "other term" to filter only free models on OpenRouter
- Use arrow keys to navigate, Enter to select

**Reasoning Display:**
Models that support reasoning (like DeepSeek) will show their thinking process in a separate section above the main response. The thinking section is collapsible - it expands automatically as reasoning streams, then auto-collapses when the main response begins.

**Markdown Formatting:**
All AI responses support markdown formatting including **bold**, *italic*, `code blocks`, lists, and more. The formatting is rendered automatically in both responses and reasoning traces.

### View Tabs
At the top right, you'll find three tabs:
- **README** – See this documentation (you're reading it!)
- **Prompt** – Edit and preview the active prompt
- **Files** – Browse and manage your loaded files

### Clear All Data
The **Clear All** button at the bottom of the left panel deletes all 10 chat threads at once, including all messages, prompts, and settings. Use with caution!

---

## Tips & Tricks

- **Start with the Assistant:** New to Fusion Studio? Click the **💬 Assistant** button at the top of the left panel
- **Organize your chats:** Use descriptive names like "Debug Session" or "Brainstorm Ideas"
- **Save your prompts:** Keep useful prompts in `.md` files for quick loading
- **Try the local model:** No API key? Use the **🏠 Phi-3-mini (Local)** model
- **Export frequently:** Back up important conversations before they get too long

---

## Troubleshooting

**API calls aren't working:**
- Make sure your API key is set correctly (click **Add API Key** in the top header)
- Check that your OpenRouter account has credits
- Verify you have internet connection
- Try using the **🏠 Phi-3-mini (Local)** model instead (no API key needed)

**Chat slots aren't saving:**
- Make sure you're not in incognito/private browsing mode
- Check if your browser allows local storage

**JSON file won't load:**
- Ensure the file is valid JSON (use a validator like jsonlint.com)
- Make sure the file extension is `.json`

---

## About Fusion Studio

Fusion Studio is a browser-based chat client built for power users who need:
- Multiple parallel conversations
- Custom system prompts
- JSON data integration
- Full conversation exports
- Local AI models (no API key required for Phi-3-mini)

Built with vanilla HTML, CSS, and JavaScript. No frameworks, no bloat.

---

Enjoy chatting! 🚀
