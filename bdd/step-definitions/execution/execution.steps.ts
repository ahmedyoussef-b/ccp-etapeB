import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../support/world';

Given('une procédure {string} m\'est assignée', async function (this: CustomWorld, procedureName: string) {
  await this.page.goto('/procedures/assigned');
  await this.page.waitForSelector(`text=${procedureName}`);
});

Given('que j\'ai lu le briefing', async function (this: CustomWorld) {
  await this.page.click('text=Briefing');
  await this.page.waitForSelector('.briefing-content');
});

Given('que je suis en phase d\'exécution', async function (this: CustomWorld) {
  await this.page.goto('/execution');
  await this.page.waitForSelector('.execution-phase');
});

Given('que je suis en cours d\'exécution', async function (this: CustomWorld) {
  await this.page.goto('/execution');
  await this.page.waitForSelector('.execution-phase');
});

Given('que j\'ai terminé toutes les étapes', async function (this: CustomWorld) {
  const steps = this.page.locator('.step-item');
  const count = await steps.count();
  for (let i = 0; i < count; i++) {
    await steps.nth(i).locator('.complete-step').click();
  }
});

Given('que je suis en cours d\'exécution', async function (this: CustomWorld) {
  await this.page.goto('/execution');
  await this.page.waitForSelector('.execution-phase');
});

Given('je perds la connexion internet', async function (this: CustomWorld) {
  await this.page.context().setOffline(true);
});

When('je clique sur {string}', async function (this: CustomWorld, buttonText: string) {
  await this.page.click(`text=${buttonText}`);
});

When('je sélectionne la procédure {string}', async function (this: CustomWorld, procedureName: string) {
  await this.page.click(`text=${procedureName}`);
});

When('je coche tous les prérequis', async function (this: CustomWorld) {
  const checkboxes = this.page.locator('.prerequisite-checkbox');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
});

When('je complète l\'étape {string}', async function (this: CustomWorld, stepName: string) {
  await this.page.click(`.step-item:has-text("${stepName}") .complete-step`);
});

When('je passe à l\'étape suivante', async function (this: CustomWorld) {
  await this.page.click('text=Étape suivante');
});

When('je sélectionne la gravité {string}', async function (this: CustomWorld, gravite: string) {
  await this.page.selectOption('select[name="severity"]', gravite);
});

When('je saisis la description {string}', async function (this: CustomWorld, description: string) {
  await this.page.fill('textarea[name="description"]', description);
});

When('je joins une photo', async function (this: CustomWorld) {
  await this.page.setInputFiles('input[type="file"]', 'bdd/fixtures/photo-anomalie.jpg');
});

When('je saisis la raison {string}', async function (this: CustomWorld, raison: string) {
  await this.page.fill('textarea[name="reason"]', raison);
});

When('je confirme', async function (this: CustomWorld) {
  await this.page.click('text=Confirmer');
});

When('la connexion est rétablie', async function (this: CustomWorld) {
  await this.page.context().setOffline(false);
});

Then('je vois la phase {string}', async function (this: CustomWorld, phase: string) {
  await expect(this.page.locator('.phase-indicator')).toHaveText(phase);
});

Then('le briefing de la procédure s\'affiche', async function (this: CustomWorld) {
  await expect(this.page.locator('.briefing-content')).toBeVisible();
});

Then('je vois la liste des prérequis', async function (this: CustomWorld) {
  await expect(this.page.locator('.prerequisites-list')).toBeVisible();
});

Then('je suis dans la phase {string}', async function (this: CustomWorld, phase: string) {
  await expect(this.page.locator('.phase-indicator')).toHaveText(phase);
});

Then('l\'étape est marquée comme terminée', async function (this: CustomWorld) {
  await expect(this.page.locator('.step-item.completed')).toBeVisible();
});

Then('le timer de l\'étape s\'arrête', async function (this: CustomWorld) {
  const timerText = await this.page.locator('.step-timer').textContent();
  await this.page.waitForTimeout(1500);
  const newTimerText = await this.page.locator('.step-timer').textContent();
  expect(timerText).toBe(newTimerText);
});

Then('le timer de l\'étape suivante démarre', async function (this: CustomWorld) {
  await expect(this.page.locator('.step-timer.running')).toBeVisible();
});

Then('l\'anomalie est enregistrée', async function (this: CustomWorld) {
  await expect(this.page.locator('.anomaly-confirmation')).toBeVisible();
});

Then('le superviseur est notifié', async function (this: CustomWorld) {
  await expect(this.page.locator('.notification-sent')).toBeVisible();
});

Then('la procédure est marquée comme {string}', async function (this: CustomWorld, statut: string) {
  await expect(this.page.locator('.procedure-status')).toHaveText(statut);
});

Then('un résumé s\'affiche avec le temps total', async function (this: CustomWorld) {
  await expect(this.page.locator('.execution-summary')).toBeVisible();
  await expect(this.page.locator('.total-time')).toBeVisible();
});

Then('je peux continuer l\'exécution', async function (this: CustomWorld) {
  await expect(this.page.locator('.execution-phase')).toBeVisible();
});

Then('les données sont sauvegardées localement', async function (this: CustomWorld) {
  const storage = await this.page.evaluate(() => localStorage.getItem('pendingSync'));
  expect(storage).toBeTruthy();
});

Then('les données sont synchronisées automatiquement', async function (this: CustomWorld) {
  await this.page.waitForSelector('.sync-complete', { timeout: 10000 });
});
