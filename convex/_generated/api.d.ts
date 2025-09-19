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
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as categoryAttributes from "../categoryAttributes.js";
import type * as clinics from "../clinics.js";
import type * as comments from "../comments.js";
import type * as departments from "../departments.js";
import type * as init from "../init.js";
import type * as lib_utils from "../lib/utils.js";
import type * as presence from "../presence.js";
import type * as roles from "../roles.js";
import type * as tags from "../tags.js";
import type * as ticketAttributes from "../ticketAttributes.js";
import type * as tickets from "../tickets.js";
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
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  categories: typeof categories;
  categoryAttributes: typeof categoryAttributes;
  clinics: typeof clinics;
  comments: typeof comments;
  departments: typeof departments;
  init: typeof init;
  "lib/utils": typeof lib_utils;
  presence: typeof presence;
  roles: typeof roles;
  tags: typeof tags;
  ticketAttributes: typeof ticketAttributes;
  tickets: typeof tickets;
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
