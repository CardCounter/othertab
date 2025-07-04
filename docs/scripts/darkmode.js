const darkToggleButton = document.getElementById('dark-toggle');

darkToggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    darkToggleButton.textContent = isDark ? 'light mode' : 'dark mode';
    
    // Store user preference in localStorage
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
});

// Check for saved preference when page loads
document.addEventListener('DOMContentLoaded', () => {
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
        darkToggleButton.textContent = 'light mode';
    }
});

// change to looking at class for multiple dark mode buttons

// const darkToggleButtons = document.querySelectorAll('.dark-toggle');

// function updateDarkModeUI(isDark) {
//     document.body.classList.toggle('dark-mode', isDark);
//     darkToggleButtons.forEach(btn => {
//         btn.textContent = isDark ? 'light mode' : 'dark mode';
//     });
// }

// darkToggleButtons.forEach(button => {
//     button.addEventListener('click', () => {
//         const isDark = !document.body.classList.contains('dark-mode');
//         updateDarkModeUI(isDark);
//         localStorage.setItem('darkMode', isDark);
//     });
// });

// // On page load
// document.addEventListener('DOMContentLoaded', () => {
//     const savedDarkMode = localStorage.getItem('darkMode') === 'true';
//     updateDarkModeUI(savedDarkMode);
// });