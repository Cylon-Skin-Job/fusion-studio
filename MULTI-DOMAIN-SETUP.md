# Multi-Domain Setup for Fusion Studio
## 27 Domains = 270 Total Threads 🚀

---

## The Strategy

**Single Firebase project, multiple custom domains**

Since localStorage is subdomain-specific:
- `yourdomain.com` = 10 threads
- `a.yourdomain.com` = 10 threads  
- `b.yourdomain.com` = 10 threads
- ... × 27 = **270 threads total!**

**Benefits:**
- ✅ One codebase
- ✅ Single deployment updates all domains
- ✅ Each domain = isolated localStorage
- ✅ Easy to maintain

---

## Step 1: Add Domains to Firebase (Easy Way)

### Option A: Firebase Console (Recommended)

1. Go to your Firebase project hosting page
2. Click **"Add custom domain"**
3. Add each domain one by one:
   - `yourdomain.com`
   - `a.yourdomain.com`
   - `b.yourdomain.com`
   - `c.yourdomain.com`
   - ... (continue through z)

Firebase will give you DNS records for each.

### Option B: Firebase CLI

```bash
# Add root domain
firebase hosting:site:create your-site-name

# Unfortunately, Firebase CLI doesn't support adding custom domains directly
# You'll need to use the Console for this step
```

---

## Step 2: DNS Configuration

Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)

### For Root Domain (yourdomain.com)

```
Type: A
Name: @
Value: [IP addresses from Firebase Console]
```

### For All Subdomains (a-z)

**Option 1: Individual CNAME records (more reliable)**
```
Type: CNAME
Name: a
Value: your-firebase-project.web.app

Type: CNAME  
Name: b
Value: your-firebase-project.web.app

... (repeat for c through z)
```

**Option 2: Wildcard CNAME (if your registrar supports it)**
```
Type: CNAME
Name: *
Value: your-firebase-project.web.app
```

⚠️ **Note:** Wildcard won't work for Firebase custom domain verification. You'll need individual CNAMEs.

---

## Step 3: Verification

After adding domains in Firebase:
1. Firebase will provide TXT records for verification
2. Add these to your DNS
3. Wait 5-10 minutes for DNS propagation
4. Firebase will auto-verify and provision SSL certificates

---

## Step 4: Test All Domains

```bash
# Quick test script
for letter in {a..z}; do
  echo "Testing ${letter}.yourdomain.com"
  curl -I "https://${letter}.yourdomain.com" 2>/dev/null | grep "HTTP"
done
```

Or just visit in browser:
- https://yourdomain.com
- https://a.yourdomain.com
- https://b.yourdomain.com
- etc.

---

## Deployment Workflow

### Update All 27 Domains at Once

```bash
cd /path/to/fusion-studio
firebase deploy
```

That's it! All 27 domains update instantly with the same code.

---

## DNS Record Template

Copy/paste this into your DNS provider:

```
# Root
@ A [Firebase IP 1]
@ A [Firebase IP 2]

# Subdomains (a-z)
a CNAME your-firebase-project.web.app
b CNAME your-firebase-project.web.app
c CNAME your-firebase-project.web.app
d CNAME your-firebase-project.web.app
e CNAME your-firebase-project.web.app
f CNAME your-firebase-project.web.app
g CNAME your-firebase-project.web.app
h CNAME your-firebase-project.web.app
i CNAME your-firebase-project.web.app
j CNAME your-firebase-project.web.app
k CNAME your-firebase-project.web.app
l CNAME your-firebase-project.web.app
m CNAME your-firebase-project.web.app
n CNAME your-firebase-project.web.app
o CNAME your-firebase-project.web.app
p CNAME your-firebase-project.web.app
q CNAME your-firebase-project.web.app
r CNAME your-firebase-project.web.app
s CNAME your-firebase-project.web.app
t CNAME your-firebase-project.web.app
u CNAME your-firebase-project.web.app
v CNAME your-firebase-project.web.app
w CNAME your-firebase-project.web.app
x CNAME your-firebase-project.web.app
y CNAME your-firebase-project.web.app
z CNAME your-firebase-project.web.app
```

---

## User Experience

**Landing Page:** https://yourdomain.com

Users can navigate to:
- **a.yourdomain.com** through **z.yourdomain.com** for separate workspaces
- Each domain maintains its own chat history, prompts, API keys
- Same app, different storage containers

**Suggested Use Cases:**
- Different projects (a = work, b = personal, c = research)
- Different clients
- Different AI models/prompts per domain
- Backup/archive domains

---

## Cost

Still **FREE** on Firebase:
- Unlimited custom domains
- Single deployment serves all
- Shared bandwidth quota (10GB storage, 360MB/day transfer)
- Fusion Studio is tiny, so no worries

---

## Maintenance

```bash
# Deploy updates to all domains
firebase deploy

# View hosting status
firebase hosting:sites:list

# Check domain status
firebase hosting:channel:list
```

---

## Troubleshooting

**SSL certificate pending:**
- Wait 10-15 minutes after DNS verification
- Firebase auto-provisions certificates

**Domain not resolving:**
- Check DNS propagation: https://dnschecker.org
- Verify CNAME points to `your-firebase-project.web.app`

**One domain not working:**
- Re-verify in Firebase Console
- Check for typos in DNS records

---

## Quick Start Checklist

- [ ] Add all 27 domains in Firebase Console
- [ ] Copy DNS records from Firebase
- [ ] Add DNS records in domain registrar
- [ ] Wait for verification (5-15 min each)
- [ ] Wait for SSL certificates (auto)
- [ ] Test each domain
- [ ] Deploy once: `firebase deploy`
- [ ] All domains update! 🎉

