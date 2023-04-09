describe('Index page working as expected', () => {
    beforeEach(() => {
        // Listen for console errors
        cy.on('window:console', (message) => {
            if (message.type === 'error') {
                // Fail the test if there is a console error
                assert.fail(`Console error: ${message.text}`);
            }
        });
    });

    it('Checks search functionality', () => {
        // Intercept all network requests
        cy.intercept('*').as('networkRequest');

        // Step 1: Visit the index page
        cy.visit('index.html');

        // Step 2: Check if there is a search-container containing a search input
        cy.get('.search-container').within(() => {
            cy.get('input[type="search"]').as('searchInput');
        });

        // Step 3: Type "Tetris" into the input
        cy.get('@searchInput').type('Tetris');

        // Step 4: Check if there is only one visible "div.game-card" element
        cy.get('div.game-card:visible').should('have.length', 2);
    });

    it('Checks if every page has some visible elements', () => {
        // Visit the index page
        cy.visit('index.html');

        // Collect all links inside "div.game-card" elements, excluding "top games and tools"
        cy.get('div.game-card')
            .not('.game-list.top div.game-card')
            .find('a')
            .then(($links) => {
                const hrefs = $links.map((index, link) => link.getAttribute('href')).get();

                // Visit each link and check if there is anything visible on the loaded page
                cy.wrap(hrefs).each((href) => {
                    // Visit the page using the local server
                    cy.visit(href);
                    // Write the content to the test browser
                    cy.document().then((doc) => {
                        // Check if there is anything visible on the loaded page
                        expect(doc.body.children.length).to.be.greaterThan(0);
                        expect(doc.visibilityState).to.equal('visible');

                        const imgs = doc.querySelectorAll('img');

                        // No images found, do nothing
                        if (imgs.length === 0) {
                            return;
                        }

                        // If there are any images on the page, check them
                        cy.wrap(imgs).each(($img) => {
                            // Check if the image has a valid src attribute
                            cy.wrap($img).should('have.attr', 'src').and('not.be.empty');

                            const src = $img.prop('src');

                            if (!src.startsWith('data:')) {
                                // Check if the image is loaded successfully
                                cy.request($img.prop('src')).its('status').should('eq', 200);
                            }
                        });
                    });
                });
            });
    });
});