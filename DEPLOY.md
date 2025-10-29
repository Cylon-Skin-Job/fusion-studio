# Fusion Studio - Firebase Deployment Playbook

**🎉 FIREBASE PROJECTS**

**PRODUCTION:**
- **Project ID:** fusionstudio-ai
- **Console:** https://console.firebase.google.com/project/fusionstudio-ai/overview
- **Domains:** fusionstudio.ai + 26 subdomains (a-z)
- **Deploy:** `firebase deploy --only hosting` (uses default)

**DEV/TEST:**
- **Project ID:** karen-os-chat
- **Live URL:** https://karen-os-chat.web.app
- **Console:** https://console.firebase.google.com/project/karen-os-chat/overview
- **Deploy:** `firebase deploy --only hosting --project dev`

---

## Prerequisites
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase account (free tier works fine)
- Logged into Firebase CLI (`firebase login`)

---

## Initial Setup (COMPLETED ✅)

### 1. Initialize Firebase Project
```bash
firebase init
```

When prompted, select:
- ✅ **Hosting** (use spacebar to select, enter to confirm)
- Choose **"Create a new project"** or **"Use an existing project"**
- If creating new: Give it a name like `karen-os` or similar
- **Public directory**: `.` (just press Enter, since our files are in root)
- **Configure as single-page app**: `N` (No)
- **Set up automatic builds with GitHub**: `N` (No)
- **Overwrite index.html**: `N` (No - keep our existing file!)

This creates:
- `firebase.json` - Hosting configuration
- `.firebaserc` - Project settings

### 2. Update .gitignore (if using Git)
Add these lines:
```
.firebase/
firebase-debug.log
.firebaserc
```

---

## Deployment Process

### Quick Deploy
```bash
firebase deploy
```

That's it! Your site goes live at `https://your-project-id.web.app`

### Deploy Specific Files Only
```bash
firebase deploy --only hosting
```

---

## Post-Deployment

### View Your Site
```bash
firebase open hosting:site
```

### View Console
```bash
firebase open
```

---

## Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the DNS setup instructions
4. Wait for SSL certificate (automatic, takes ~5-10 min)

---

## Rollback

### List Previous Deployments
```bash
firebase hosting:channel:list
```

### Rollback to Previous Version
```bash
firebase hosting:rollback
```

---

## Important Notes

⚠️ **localStorage & HTTPS:**
- Firebase Hosting is HTTPS by default (good!)
- Your API keys in localStorage work the same
- Users keep their data per domain

⚠️ **CORS & APIs:**
- OpenRouter API calls work fine from any HTTPS domain
- No CORS issues since it's all client-side

⚠️ **Caching:**
- Firebase auto-caches static files
- Users might need hard refresh after updates (Cmd+Shift+R)

---

## Troubleshooting

**"Permission denied" error:**
```bash
firebase login --reauth
```

**Wrong project selected:**
```bash
firebase use --add
```

**Clear deployment cache:**
```bash
firebase deploy --force
```

---

## Quick Reference

```bash
# Login
firebase login

# Initialize (first time)
firebase init hosting

# Deploy
firebase deploy

# View live site
firebase open hosting:site

# View logs
firebase functions:log
```

---

## Cost

✅ **Free tier includes:**
- 10GB storage
- 360MB/day transfer
- Custom domain
- SSL certificate

Fusion Studio is tiny (~50KB), so you're nowhere near limits even with heavy usage.

