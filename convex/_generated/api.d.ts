/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agent from "../agent.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as categoryAttributes from "../categoryAttributes.js";
import type * as clinics from "../clinics.js";
import type * as comments from "../comments.js";
import type * as counters from "../counters.js";
import type * as departments from "../departments.js";
import type * as init from "../init.js";
import type * as kbArticles from "../kbArticles.js";
import type * as kbComments from "../kbComments.js";
import type * as lib_utils from "../lib/utils.js";
import type * as macros from "../macros.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as roles from "../roles.js";
import type * as slaRules from "../slaRules.js";
import type * as tags from "../tags.js";
import type * as ticketAttributes from "../ticketAttributes.js";
import type * as ticketComments from "../ticketComments.js";
import type * as ticketStatuses from "../ticketStatuses.js";
import type * as ticketViews from "../ticketViews.js";
import type * as tickets from "../tickets.js";
import type * as triggers from "../triggers.js";
import type * as userClinics from "../userClinics.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  categories: typeof categories;
  categoryAttributes: typeof categoryAttributes;
  clinics: typeof clinics;
  comments: typeof comments;
  counters: typeof counters;
  departments: typeof departments;
  init: typeof init;
  kbArticles: typeof kbArticles;
  kbComments: typeof kbComments;
  "lib/utils": typeof lib_utils;
  macros: typeof macros;
  notifications: typeof notifications;
  presence: typeof presence;
  roles: typeof roles;
  slaRules: typeof slaRules;
  tags: typeof tags;
  ticketAttributes: typeof ticketAttributes;
  ticketComments: typeof ticketComments;
  ticketStatuses: typeof ticketStatuses;
  ticketViews: typeof ticketViews;
  tickets: typeof tickets;
  triggers: typeof triggers;
  userClinics: typeof userClinics;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
