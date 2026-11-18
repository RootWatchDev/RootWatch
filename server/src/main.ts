// Polyfill ECMAScript Set Methods for Node < 22 compatibility
if (!(Set.prototype as any).difference) {
  (Set.prototype as any).difference = function (other: Set<any>) {
    const result = new Set(this);
    for (const elem of other) {
      result.delete(elem);
    }
    return result;
  };
}
if (!(Set.prototype as any).intersection) {
  (Set.prototype as any).intersection = function (other: Set<any>) {
    const result = new Set();
    for (const elem of other) {
      if (this.has(elem)) {
        result.add(elem);
      }
    }
    return result;
  };
}
if (!(Set.prototype as any).union) {
  (Set.prototype as any).union = function (other: Set<any>) {
    const result = new Set(this);
    for (const elem of other) {
      result.add(elem);
    }
    return result;
  };
}
if (!(Set.prototype as any).isSubsetOf) {
  (Set.prototype as any).isSubsetOf = function (other: Set<any>) {
    for (const elem of this) {
      if (!other.has(elem)) return false;
    }
    return true;
  };
}

import { rootServer, RootAppStartState, Client } from "@rootsdk/server-app";
import { watchService } from "./watchService";

async function onStarting(_state: RootAppStartState) {
  rootServer.lifecycle.addService(watchService);

  // Handle client detachment to keep spectator list accurate
  rootServer.clients.on("user.detached", (client: Client) => {
    watchService.removeSpectator(client.userId);
  });
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
