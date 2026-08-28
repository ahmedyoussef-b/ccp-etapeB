import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../support/world';

Given('une procédure existante en brouillon', async function (this: CustomWorld) {
  await this.page.goto('/procedures');
  await this.page.click('text=Procédure test brouillon');
});

Given('une procédure en brouillon', async function (this: CustomWorld) {
  await this.page.goto('/procedures');
  await this.page.click('text=Procédure test brouillon');
});

Given('une procédure approuvée', async function (this: CustomWorld) {
  await this.page.goto('/procedures');
  await this.page.click('text=Procédure test approuvée');
});

Given('une procédure est en attente de validation', async function (this: CustomWorld) {
  await this.page.goto('/procedures?status=submitted');
  await this.page.waitForSelector('text=Soumise');
});

When('je clique sur {string}', async function (this: CustomWorld, buttonText: string) {
  await this.page.click(`text=${buttonText}`);
});

When('je saisis le titre {string}', async function (this: CustomWorld, titre: string) {
  await this.page.fill('input[name="title"]', titre);
});

When('je saisis la description {string}', async function (this: CustomWorld, description: string) {
  await this.page.fill('textarea[name="description"]', description);
});

When('j\'ajoute une étape avec le titre {string}', async function (this: CustomWorld, titre: string) {
  await this.page.click('text=Ajouter une étape');
  await this.page.fill('input[name="stepTitle"]', titre);
  await this.page.click('text=Confirmer');
});

When('j\'ajoute une étape {string}', async function (this: CustomWorld, titre: string) {
  await this.page.click('text=Ajouter une étape');
  await this.page.fill('input[name="stepTitle"]', titre);
  await this.page.click('text=Confirmer');
});

When('je déplace l\'étape à la position {int}', async function (this: CustomWorld, position: number) {
  const dragHandle = this.page.locator('.drag-handle').first();
  const target = this.page.locator('.step-item').nth(position - 1);
  await dragHandle.dragTo(target);
});

When('je saisis le commentaire {string}', async function (this: CustomWorld, commentaire: string) {
  await this.page.fill('textarea[name="comment"]', commentaire);
});

When('je sélectionne un fichier JSON valide', async function (this: CustomWorld) {
  await this.page.setInputFiles('input[type="file"]', 'bdd/fixtures/procedure-valide.json');
});

When('je modifie le titre', async function (this: CustomWorld) {
  await this.page.fill('input[name="title"]', 'Procédure modifiée v2');
});

When('je soumets pour validation', async function (this: CustomWorld) {
  await this.page.click('text=Soumettre pour validation');
});

Then('je vois le message {string}', async function (this: CustomWorld, message: string) {
  await expect(this.page.locator('body')).toContainText(message);
});

Then('la procédure apparaît dans la liste avec le statut {string}', async function (this: CustomWorld, statut: string) {
  await expect(this.page.locator('.procedure-list')).toContainText(statut);
});

Then('l\'ordre des étapes est mis à jour', async function (this: CustomWorld) {
  await expect(this.page.locator('.step-item').first()).toContainText('Vérifier les sorties');
});

Then('le statut de la procédure devient {string}', async function (this: CustomWorld, statut: string) {
  await expect(this.page.locator('.procedure-status')).toHaveText(statut);
});

Then('le superviseur reçoit une notification', async function (this: CustomWorld) {
  await expect(this.page.locator('.notification-badge')).toBeVisible();
});

Then('le chef de quart reçoit la notification de rejet', async function (this: CustomWorld) {
  await expect(this.page.locator('.notification-rejection')).toBeVisible();
});

Then('un fichier JSON est téléchargé', async function (this: CustomWorld) {
  const downloadPromise = this.page.waitForEvent('download');
  await this.page.click('text=Exporter');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.json');
});

Then('le fichier contient toutes les étapes de la procédure', async function (this: CustomWorld) {
  const downloadPromise = this.page.waitForEvent('download');
  await this.page.click('text=Exporter');
  const download = await downloadPromise;
  const path = await download.path();
  const fs = require('fs');
  const content = JSON.parse(fs.readFileSync(path, 'utf-8'));
  expect(content.steps).toBeDefined();
  expect(content.steps.length).toBeGreaterThan(0);
});

Then('la procédure est créée avec succès', async function (this: CustomWorld) {
  await expect(this.page.locator('.success-message')).toBeVisible();
});

Then('une nouvelle version est créée', async function (this: CustomWorld) {
  await expect(this.page.locator('.version-badge')).toContainText('v2');
});

Then('l\'ancienne version reste accessible', async function (this: CustomWorld) {
  await this.page.click('text=Historique des versions');
  await expect(this.page.locator('.version-item')).toHaveCount(2);
});
