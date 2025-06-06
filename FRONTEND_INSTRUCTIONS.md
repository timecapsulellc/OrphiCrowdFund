When you run the development server with the script I created, you should see output that includes a local URL where you can access the application. Typically, it will be something like:

http://localhost:5173

Follow these steps to render the frontend in your local browser:

1. Open your terminal
2. Navigate to the Orphi CrowdFund directory:
   ```
   cd "/Users/dadou/Orphi CrowdFund"
   ```

3. Make the script executable:
   ```
   chmod +x start-dev-server.sh
   ```

4. Run the script:
   ```
   ./start-dev-server.sh
   ```

5. Alternatively, you can run the development server directly:
   ```
   npm run dev
   ```

6. If that doesn't work, try using Vite directly:
   ```
   npx vite
   ```

7. When the server starts, open your browser and navigate to:
   http://localhost:5173

Your OrphiChain Dashboard should now be visible in the browser. You'll see the tab navigation with:
- Logo Demo
- Orphi Dashboard
- Team Analytics
- Genealogy Tree
- Network Visualization

The App.jsx file you showed me looks correct - it imports all the necessary components and renders them based on the selected tab. When you click on different tabs, the corresponding components will load with proper error boundaries and loading states.

If you encounter any issues with rendering, please check the browser console for errors.
