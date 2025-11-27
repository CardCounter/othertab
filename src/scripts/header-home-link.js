const HOME_SELECTORS = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    '.title'
];

const homeUrlAttribute =
    document.documentElement.dataset.homeUrl ||
    document.body.dataset.homeUrl ||
    '/';

const normalizedHomeUrl = homeUrlAttribute.trim() || '/';

const redirectHome = () => {
    window.location.assign(normalizedHomeUrl);
};

const headings = document.querySelectorAll(HOME_SELECTORS.join(', '));

headings.forEach((heading) => {
    if (!heading || heading.dataset.homeLink === 'disabled') {
        return;
    }

    heading.classList.add('heading-home-link');

    if (!heading.hasAttribute('role')) {
        heading.setAttribute('role', 'link');
    }

    if (!heading.hasAttribute('tabindex')) {
        heading.tabIndex = 0;
    }

    heading.addEventListener('click', (event) => {
        event.preventDefault();
        redirectHome();
    });

    heading.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            redirectHome();
        }
    });
});
