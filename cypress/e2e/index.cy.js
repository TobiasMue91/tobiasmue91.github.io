describe('Index page working as expected', () => {
    it('Checks search functionality and checks if every page has some visible elements', () => {
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
        cy.get('div.game-card:visible').should('have.length', 1);

        cy.get('@searchInput').clear();

        // Step 5: Collect all links inside "div.game-card" elements, excluding "top games and tools"
        cy.get('div.game-card')
            .not('.game-list.top div.game-card')
            .find('a')
            .then(($links) => {
                const hrefs = $links.map((index, link) => link.getAttribute('href')).get();

                // Visit each link and check if there is anything visible on the loaded page
                hrefs.forEach((href) => {
                    // Read the local HTML file
                    cy.readFile(href, 'utf-8').then((html) => {
                        // Write the content to the test browser
                        cy.document().then((doc) => {
                            doc.documentElement.innerHTML = html;

                            // Wait for all network requests to complete
                            cy.wait('@networkRequest');

                            // Check if there is anything visible on the loaded page
                            expect(doc.body.children.length).to.be.greaterThan(0);
                            expect(doc.visibilityState).to.equal('visible');

                            // Listen for console errors
                            cy.on('window:console', (message) => {
                                if (message.type === 'error') {
                                    // Fail the test if there is a console error
                                    assert.fail(`Console error: ${message.text}`);
                                }
                            });
                        });
                    });
                });
            });
    });
});