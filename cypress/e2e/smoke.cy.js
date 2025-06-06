// smoke.cy.js - Basic E2E test for OrphiCrowdFund dashboard

describe('OrphiCrowdFund Dashboard Smoke Test', () => {
  it('loads the dashboard and displays main sections', () => {
    cy.visit('/');
    cy.contains('Orphi Dashboard').should('exist');
    cy.contains('Team Analytics').should('exist');
    cy.contains('Genealogy Tree').should('exist');
    cy.contains('Network Visualization').should('exist');
  });
});
