import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { BrowserContext, Page } from 'playwright';

export interface CustomWorld extends World {
  page: Page;
  context: BrowserContext;
  testData: Map<string, unknown>;
}

class NexaFlowWorld extends World {
  testData: Map<string, unknown>;

  constructor(options: IWorldOptions) {
    super(options);
    this.testData = new Map();
  }
}

setWorldConstructor(NexaFlowWorld);
