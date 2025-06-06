// Add this to the top of your main.jsx file to catch and log errors
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
  // Add a visible error message on the page
  const errorElement = document.createElement('div');
  errorElement.style.position = 'fixed';
  errorElement.style.top = '0';
  errorElement.style.left = '0';
  errorElement.style.right = '0';
  errorElement.style.padding = '20px';
  errorElement.style.background = 'red';
  errorElement.style.color = 'white';
  errorElement.style.zIndex = '9999';
  errorElement.textContent = `Error: ${event.error?.message || 'Unknown error'}`;
  document.body.appendChild(errorElement);
});

// Add this before rendering your app
console.log('OrphiChain Dashboard initializing...');
