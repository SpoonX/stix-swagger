import * as config from '../config/index';
import {
  ModuleInterface,
  Event,
  ModuleManager,
  ApplicationEvents,
  Application,
  ServerService,
  createDebugLogger,
} from 'stix';

const debug = createDebugLogger('stix:swagger');
const isProduction = process.env.NODE_ENV === 'production';

/**
 * This file is the main class of your module.
 * This is where stix will collect the configuration and call init() and/or onBootstrap().
 */
export class Swagger implements ModuleInterface {
  init (moduleManager: ModuleManager) {
    if (isProduction) {
      return;
    }

    moduleManager
      .getEventManager()
      .getSharedEventManager()
      .attachOnce(ApplicationEvents.Ready, (event: Event<Application>) => {
        const serviceManager = event.getTarget().getServiceManager();

        debug(`Swagger docs running: ${serviceManager.get(ServerService).getURL()}swagger/ui`);
      });
  }

  getConfig () {
    if (isProduction) {
      return null;
    }

    return config;
  }
}
