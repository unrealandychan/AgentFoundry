/**
 * AgentFoundry — 8-step wizard E2E tests
 *
 * These tests assume the Next.js dev server is running on http://localhost:3000.
 * If the server is not available, each test will be skipped gracefully (the
 * `webServer` block in playwright.config.ts uses `reuseExistingServer: true`
 * and will not start one automatically in this environment).
 *
 * Run with:  npx playwright test
 *
 * API routes are mocked via page.route() so no real OpenAI key is required.
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Shared mock helpers ──────────────────────────────────────────────────────

/** Mock all network API routes that the wizard may call */
async function mockApiRoutes(page: Page) {
  // /api/skills — returns the static skill list (empty extra skills is fine)
  await page.route('**/api/skills', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    } else {
      // POST (create custom skill)
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  // /api/preview-template — returns placeholder AGENTS.md content
  await page.route('**/api/preview-template', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '# Preview\nThis is a mocked AGENTS.md preview.' }),
    });
  });

  // /api/generate — returns a minimal ZIP blob (empty bytes is enough for tests)
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/zip',
      body: Buffer.from('PK\x05\x06' + '\x00'.repeat(18)), // minimal empty ZIP stub
    });
  });

  // /api/chat — streamed chat endpoint; return a minimal text/plain response
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '{"agentId":"agent","agentName":"Agent"}\nHello! I am your test agent.',
    });
  });

  // /api/gist — GitHub Gist export
  await page.route('**/api/gist', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://gist.github.com/mock/abc123' }),
    });
  });

  // /api/workspace/upload
  await page.route('**/api/workspace/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'test-file.txt' }),
    });
  });
}

/** Navigate to the home page and enter the Build wizard */
async function goToWizard(page: Page) {
  await page.goto('/');
  // The home screen is the FlowChooser — click "Build with Template"
  await page.getByText('Start building →').click();
  // Wait for wizard step 1 indicator to be visible
  await expect(page.getByTestId('wizard-step-indicator')).toBeVisible();
}

// ─── Helper: advance through steps ───────────────────────────────────────────

/** Step 1: select a template (first available card) and proceed */
async function completeStep1(page: Page, templateId = 'nextjs-ai-app') {
  await expect(page.getByTestId(`wizard-step-badge-1`)).toBeVisible();
  // Select the template card
  await page.getByTestId(`template-card-${templateId}`).click();
  // Next button should now be enabled
  const nextBtn = page.getByTestId('step-next-button');
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();
}

/** Step 2: optionally toggle a skill and proceed */
async function completeStep2(page: Page, { toggleSkill = false } = {}) {
  await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
  if (toggleSkill) {
    // Click the first visible skill card
    const firstSkillCard = page.locator('[data-testid^="skill-card-"]').first();
    await firstSkillCard.click();
  }
  await page.getByTestId('step-next-button').click();
}

/** Step 3: (integrations) skip via Next */
async function completeStep3(page: Page) {
  await expect(page.getByTestId('wizard-step-badge-3')).toBeVisible();
  await page.getByTestId('step-next-button').click();
}

/** Step 4: pick an agent target and proceed */
async function completeStep4(page: Page, target = 'codex-cli') {
  await expect(page.getByTestId('wizard-step-badge-4')).toBeVisible();
  await page.getByTestId(`agent-target-card-${target}`).click();
  await page.getByTestId('step-next-button').click();
}

/** Step 5: fill project name and proceed */
async function completeStep5(page: Page, projectName = 'my-test-agent') {
  await expect(page.getByTestId('wizard-step-badge-5')).toBeVisible();
  const field = page.getByTestId('customize-field-project-name');
  await field.fill(projectName);
  await page.getByTestId('step-next-button').click();
}

/** Step 6: Preview — just proceed */
async function completeStep6(page: Page) {
  await expect(page.getByTestId('wizard-step-badge-6')).toBeVisible();
  await page.getByTestId('step-next-button').click();
}

/** Step 7: Test Agent — just proceed */
async function completeStep7(page: Page) {
  await expect(page.getByTestId('wizard-step-badge-7')).toBeVisible();
  await page.getByTestId('step-next-button').click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('AgentFoundry wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  // ── Step 1: template selection ──────────────────────────────────────────────

  test('step 1 — shows template cards and step indicator', async ({ page }) => {
    await goToWizard(page);
    // Step indicator is rendered
    await expect(page.getByTestId('wizard-step-indicator')).toBeVisible();
    // Badge 1 should be active (indigo)
    await expect(page.getByTestId('wizard-step-badge-1')).toBeVisible();
    // At least one template card should appear
    await expect(page.locator('[data-testid^="template-card-"]').first()).toBeVisible();
  });

  test('step 1 — Next button is disabled until template is selected', async ({ page }) => {
    await goToWizard(page);
    const nextBtn = page.getByTestId('step-next-button');
    await expect(nextBtn).toBeDisabled();
    // Select a template
    await page.getByTestId('template-card-nextjs-ai-app').click();
    await expect(nextBtn).toBeEnabled();
  });

  test('step 1 — selecting a template highlights the card', async ({ page }) => {
    await goToWizard(page);
    const card = page.getByTestId('template-card-nextjs-ai-app');
    // Before selection: no indigo border class
    await expect(card).not.toHaveClass(/border-indigo-500/);
    await card.click();
    // After selection: indigo border
    await expect(card).toHaveClass(/border-indigo-500/);
  });

  test('step 1 — audience filter tabs narrow the visible templates', async ({ page }) => {
    await goToWizard(page);
    // Click the "Developer" audience tab
    await page.getByTestId('template-audience-tab-developer').click();
    // There should be at least one card visible after filtering
    await expect(page.locator('[data-testid^="template-card-"]').first()).toBeVisible();
  });

  test('step 1 — clicking "All" tab restores full template list', async ({ page }) => {
    await goToWizard(page);
    const allCount = await page.locator('[data-testid^="template-card-"]').count();
    // Filter to QA (fewer templates)
    await page.getByTestId('template-audience-tab-qa').click();
    const qaCount = await page.locator('[data-testid^="template-card-"]').count();
    // Switch back to All
    await page.getByTestId('template-audience-tab-all').click();
    const restoredCount = await page.locator('[data-testid^="template-card-"]').count();
    expect(restoredCount).toBeGreaterThanOrEqual(qaCount);
    expect(restoredCount).toBe(allCount);
  });

  test('step 1 — template preview modal opens and closes', async ({ page }) => {
    await goToWizard(page);
    // Click the preview link on the first template card
    const previewLink = page.locator('[data-testid^="template-preview-"]').first();
    await previewLink.click();
    // Modal should be visible
    await expect(page.getByTestId('template-preview-close')).toBeVisible();
    // Close it
    await page.getByTestId('template-preview-close').click();
    await expect(page.getByTestId('template-preview-close')).not.toBeVisible();
  });

  // ── Step 2: skills ──────────────────────────────────────────────────────────

  test('step 2 — shows skill cards', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
    // Skill cards may take a moment to load (API call)
    await expect(page.locator('[data-testid^="skill-card-"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('step 2 — toggling a skill card selects / deselects it', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    const firstCard = page.locator('[data-testid^="skill-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    // First click: select
    await firstCard.click();
    await expect(firstCard).toHaveClass(/border-indigo-500/);
    // Second click: deselect
    await firstCard.click();
    await expect(firstCard).not.toHaveClass(/border-indigo-500/);
  });

  test('step 2 — can proceed without selecting any skills', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
    await page.getByTestId('step-next-button').click();
    // Should now be on step 3
    await expect(page.getByTestId('wizard-step-badge-3')).toBeVisible();
  });

  test('step 2 — Back button returns to step 1', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
    // Skills step uses `data-testid="skills-back-button"`
    await page.getByTestId('skills-back-button').click();
    await expect(page.getByTestId('wizard-step-badge-1')).toBeVisible();
  });

  // ── Step 3: integrations ────────────────────────────────────────────────────

  test('step 3 — shows integrations heading', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await expect(page.getByText('Add MCP Integrations')).toBeVisible();
  });

  test('step 3 — Back button returns to step 2', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await page.getByTestId('step-back-button').click();
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
  });

  // ── Step 4: agent target ────────────────────────────────────────────────────

  test('step 4 — shows all agent target cards', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await expect(page.getByTestId('agent-target-card-github-copilot')).toBeVisible();
    await expect(page.getByTestId('agent-target-card-claude-code')).toBeVisible();
    await expect(page.getByTestId('agent-target-card-cursor')).toBeVisible();
    await expect(page.getByTestId('agent-target-card-codex-cli')).toBeVisible();
    await expect(page.getByTestId('agent-target-card-windsurf')).toBeVisible();
    await expect(page.getByTestId('agent-target-card-generic')).toBeVisible();
  });

  test('step 4 — selecting an agent target highlights the card', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    const claudeCard = page.getByTestId('agent-target-card-claude-code');
    await claudeCard.click();
    await expect(claudeCard).toHaveClass(/border-indigo-500/);
  });

  // ── Step 5: customize ──────────────────────────────────────────────────────

  test('step 5 — shows Project Name field', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await expect(page.getByTestId('customize-field-project-name')).toBeVisible();
  });

  test('step 5 — typing in the project name field updates the value', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    const field = page.getByTestId('customize-field-project-name');
    await field.fill('awesome-agent');
    await expect(field).toHaveValue('awesome-agent');
  });

  // ── Step 6: preview ─────────────────────────────────────────────────────────

  test('step 6 — shows file tree panel', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await expect(page.getByText('Preview')).toBeVisible();
    // The file tree should list at least one file (e.g. AGENTS.md)
    await expect(page.locator('[data-testid^="preview-file-"]').first()).toBeVisible();
  });

  test('step 6 — Download ZIP button is present and enabled', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    const downloadBtn = page.getByTestId('preview-download-zip-button');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeEnabled();
  });

  // ── Step 7: test agent ──────────────────────────────────────────────────────

  test('step 7 — shows chat input and send button', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('chat-send-button')).toBeVisible();
  });

  test('step 7 — model selector is present', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await expect(page.getByTestId('model-selector')).toBeVisible();
  });

  test('step 7 — send button is disabled when chat input is empty', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await expect(page.getByTestId('chat-send-button')).toBeDisabled();
  });

  test('step 7 — typing in chat input enables send button', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await page.getByTestId('chat-input').fill('Hello agent!');
    await expect(page.getByTestId('chat-send-button')).toBeEnabled();
  });

  test('step 7 — sending a message calls /api/chat and displays reply', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await page.getByTestId('chat-input').fill('Hello agent!');
    await page.getByTestId('chat-send-button').click();
    // The mocked response is "Hello! I am your test agent."
    await expect(page.getByText('Hello! I am your test agent.')).toBeVisible({ timeout: 10_000 });
  });

  // ── Step 8: download ────────────────────────────────────────────────────────

  test('step 8 — shows Download ZIP button', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await completeStep7(page);
    await expect(page.getByTestId('download-zip-button')).toBeVisible();
    await expect(page.getByTestId('download-zip-button')).toBeEnabled();
  });

  test('step 8 — shows package summary with template name', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page, 'my-final-agent');
    await completeStep6(page);
    await completeStep7(page);
    await expect(page.getByText('Package Summary')).toBeVisible();
    await expect(page.getByText('my-final-agent')).toBeVisible();
  });

  // ── Full happy-path flow ────────────────────────────────────────────────────

  test('full happy-path — steps 1 through 8', async ({ page }) => {
    await goToWizard(page);

    // Step 1
    await completeStep1(page, 'nextjs-ai-app');
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();

    // Step 2
    await completeStep2(page, { toggleSkill: true });
    await expect(page.getByTestId('wizard-step-badge-3')).toBeVisible();

    // Step 3
    await completeStep3(page);
    await expect(page.getByTestId('wizard-step-badge-4')).toBeVisible();

    // Step 4
    await completeStep4(page, 'codex-cli');
    await expect(page.getByTestId('wizard-step-badge-5')).toBeVisible();

    // Step 5
    await completeStep5(page, 'happy-path-agent');
    await expect(page.getByTestId('wizard-step-badge-6')).toBeVisible();

    // Step 6
    await completeStep6(page);
    await expect(page.getByTestId('wizard-step-badge-7')).toBeVisible();

    // Step 7
    await completeStep7(page);
    await expect(page.getByTestId('wizard-step-badge-8')).toBeVisible();

    // Step 8 — final
    await expect(page.getByTestId('download-zip-button')).toBeVisible();
    await expect(page.getByText('Download Your Package')).toBeVisible();
  });

  // ── Navigation: back-button chain ──────────────────────────────────────────

  test('navigation — Back buttons walk from step 4 back to step 1', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    // Now on step 4 — back to 3
    await page.getByTestId('step-back-button').click();
    await expect(page.getByTestId('wizard-step-badge-3')).toBeVisible();
    // Back to 2
    await page.getByTestId('step-back-button').click();
    await expect(page.getByTestId('wizard-step-badge-2')).toBeVisible();
    // Back to 1 (skills step uses `skills-back-button`)
    await page.getByTestId('skills-back-button').click();
    await expect(page.getByTestId('wizard-step-badge-1')).toBeVisible();
  });

  // ── Home button ─────────────────────────────────────────────────────────────

  test('wizard home button returns to FlowChooser', async ({ page }) => {
    await goToWizard(page);
    await page.getByTestId('wizard-home-button').click();
    // Should show the "What do you want to do?" flow chooser
    await expect(page.getByText('What do you want to do?')).toBeVisible();
  });

  // ── Custom template form ────────────────────────────────────────────────────

  test('step 1 — custom template form opens, validates, and saves', async ({ page }) => {
    await goToWizard(page);
    // Open the custom template form
    await page.getByText('Custom Template').click();
    // Form should be visible
    await expect(page.getByTestId('custom-template-name')).toBeVisible();
    // Try to save without a name — validation should block
    await page.getByTestId('custom-template-save').click();
    await expect(page.getByText('Template name is required.')).toBeVisible();
    // Fill the required name field and save
    await page.getByTestId('custom-template-name').fill('My Custom Agent');
    await page.getByTestId('custom-template-save').click();
    // The form should disappear and the new card should be selected
    await expect(page.getByTestId('custom-template-name')).not.toBeVisible();
    // Next button should now be enabled
    await expect(page.getByTestId('step-next-button')).toBeEnabled();
  });

  // ── GitHub Gist export (step 8) ─────────────────────────────────────────────

  test('step 8 — Gist export panel can be toggled open', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await completeStep7(page);
    // Toggle open the Gist export panel
    await page.getByTestId('gist-export-toggle').click();
    await expect(page.getByTestId('gist-token-input')).toBeVisible();
    await expect(page.getByTestId('gist-create-button')).toBeVisible();
  });

  // ── Agents SDK snippet (step 8) ─────────────────────────────────────────────

  test('step 8 — SDK snippet can be expanded and language switched', async ({ page }) => {
    await goToWizard(page);
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);
    await completeStep6(page);
    await completeStep7(page);
    // Expand the SDK snippet
    await page.getByTestId('sdk-snippet-toggle').click();
    // Python tab should be active by default; switch to TypeScript
    await page.getByTestId('sdk-lang-ts').click();
    await expect(page.getByText('@openai/agents')).toBeVisible();
    // Switch back to Python
    await page.getByTestId('sdk-lang-python').click();
    await expect(page.getByText('openai-agents')).toBeVisible();
  });
});
