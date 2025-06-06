# OrphiChain Dashboard - Troubleshooting Blank Page

## Quick Fix Steps

### Step 1: Open Diagnostic Page
1. Open the file `diagnostic.html` directly in your browser
2. This will test if basic HTML/JS is working

### Step 2: Try the Test App
We've temporarily switched to a simple test app to isolate the issue.

**Terminal Commands:**
```zsh
cd "/Users/dadou/Orphi CrowdFund"
chmod +x start-on-port-3000.sh
./start-on-port-3000.sh
```

**Alternative Method:**
```zsh
cd "/Users/dadou/Orphi CrowdFund"
npx vite --port 3000
```

### Step 3: Check Browser Console
1. Open http://localhost:3000 (or 5173)
2. Press F12 or right-click → Inspect
3. Go to Console tab
4. Look for any error messages

## Common Issues and Solutions

### Issue 1: Blank Page with No Errors
**Solution:** Check if JavaScript is enabled in your browser

### Issue 2: Module Import Errors
**Symptoms:** Console shows import/export errors
**Solution:** 
```zsh
rm -rf node_modules/.vite
npm install
npm run dev
```

### Issue 3: Port Already in Use
**Symptoms:** Error about port 3000 or 5173 being in use
**Solution:** Kill existing processes or use different port
```zsh
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npx vite --port 3001
```

### Issue 4: Component Import Errors
**Current Setup:** We're using TestApp instead of main App
- `src/main.jsx` imports `TestApp.jsx`
- `TestApp.jsx` imports `MinimalTest.jsx`
- Both are simple components that should always work

### Issue 5: CSS Not Loading
**Check:** Look for 404 errors in Network tab of browser dev tools

## Debug Information

### Current File Status
- ✅ `src/main.jsx` - Updated with debug code
- ✅ `src/TestApp.jsx` - Simple test component
- ✅ `src/MinimalTest.jsx` - Minimal working component
- ✅ `vite.config.js` - Configured for port 3000
- ✅ `index.html` - Basic HTML structure

### What Should Happen
1. You run the dev server
2. Browser opens to localhost:3000
3. You see a white page with "OrphiChain Test Page" heading
4. No console errors

### If Still Blank
1. Check browser console for errors
2. Check Network tab for failed requests
3. Try opening diagnostic.html first
4. Verify Node.js version: `node --version` (should be 16+)

## Next Steps After It Works
Once the test app loads successfully, we can:
1. Switch back to the main App component
2. Debug individual dashboard components
3. Test the full OrphiChain dashboard suite

## Contact
If none of these steps work, share:
1. Browser console errors (screenshot)
2. Terminal output when starting server
3. Node.js version (`node --version`)
4. Browser type and version
