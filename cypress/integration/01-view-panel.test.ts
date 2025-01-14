import { e2e } from '@grafana/e2e';

/**
 * Dashboard
 */
const json = require('../../provisioning/dashboards/panels.json');
const testedPanel = json.panels[0];

/**
 * Selector
 */
const getTestIdSelector = (testId: string) => `[data-testid="${testId}"]`;

/**
 * Panel
 */
describe('Viewing an Time Series panel', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({
      uid: json.uid,
    });
  });

  it('Should display a Panel', () => {
    const currentPanel = e2e.components.Panels.Panel.title(testedPanel.title);
    currentPanel.should('be.visible');
  });
});
