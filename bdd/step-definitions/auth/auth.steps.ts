import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

Given('je suis sur la page de connexion', async function (this: CustomWorld) {
  await this.page.goto(`${BASE_URL}/login`);
  await this.page.waitForSelector('form');
});

Given('je suis un utilisateur avec le rôle {string}', async function (this: CustomWorld, role: string) {
  this.testData.set('role', role);
  const credentials = {
    admin: { email: 'admin@nexaflow.fr', password: 'Admin123!' },
    superviseur: { email: 'superviseur@nexaflow.fr', password: 'Super123!' },
    chef_de_quart: { email: 'chef@nexaflow.fr', password: 'Chef123!' },
    chef_de_bloc: { email: 'bloc@nexaflow.fr', password: 'Bloc123!' },
    rondier: { email: 'rondier@nexaflow.fr', password: 'Rondier123!' }
  };
  this.testData.set('credentials', credentials[role as keyof typeof credentials]);
});

When('je saisis l\'email {string}', async function (this: CustomWorld, email: string) {
  await this.page.fill('input[name="email"]', email);
});

When('je saisis le mot de passe {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill('input[name="password"]', password);
});

When('je clique sur le bouton {string}', async function (this: CustomWorld, buttonText: string) {
  await this.page.click(`button:has-text("${buttonText}")`);
});

Then('je suis redirigé vers le tableau de bord', async function (this: CustomWorld) {
  await this.page.waitForURL('**/dashboard');
  expect(this.page.url()).toContain('/dashboard');
});

Then('je vois le message d\'erreur {string}', async function (this: CustomWorld, message: string) {
  const errorLocator = this.page.locator('.error-message, [role="alert"]');
  await expect(errorLocator).toContainText(message);
});

Then('je vois le message {string}', async function (this: CustomWorld, message: string) {
  await expect(this.page.locator('body')).toContainText(message);
});

Given('je suis connecté en tant que {string}', async function (this: CustomWorld, role: string) {
  const credentials = {
    admin: { email: 'admin@nexaflow.fr', password: 'Admin123!' },
    superviseur: { email: 'superviseur@nexaflow.fr', password: 'Super123!' },
    chef_de_quart: { email: 'chef@nexaflow.fr', password: 'Chef123!' },
    chef_de_bloc: { email: 'bloc@nexaflow.fr', password: 'Bloc123!' },
    rondier: { email: 'rondier@nexaflow.fr', password: 'Rondier123!' }
  };
  await this.page.goto(`${BASE_URL}/login`);
  await this.page.fill('input[name="email"]', credentials[role as keyof typeof credentials].email);
  await this.page.fill('input[name="password"]', credentials[role as keyof typeof credentials].password);
  await this.page.click('button[type="submit"]');
  await this.page.waitForURL('**/dashboard');
});
