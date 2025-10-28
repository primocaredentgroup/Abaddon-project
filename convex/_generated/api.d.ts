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
import type * as autoAssignSociety from "../autoAssignSociety.js";
import type * as categories from "../categories.js";
import type * as categoryAttributes from "../categoryAttributes.js";
import type * as clinics from "../clinics.js";
import type * as comments from "../comments.js";
import type * as counters from "../counters.js";
import type * as debugDomainSociety from "../debugDomainSociety.js";
import type * as departments from "../departments.js";
import type * as domainSocieties from "../domainSocieties.js";
import type * as init from "../init.js";
import type * as kbArticles from "../kbArticles.js";
import type * as kbComments from "../kbComments.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_utils from "../lib/utils.js";
import type * as macros from "../macros.js";
import type * as makeAdmin from "../makeAdmin.js";
import type * as migrations_cleanDuplicateClinics from "../migrations/cleanDuplicateClinics.js";
import type * as migrations_initializeTicketStatuses from "../migrations/initializeTicketStatuses.js";
import type * as migrations_migratePriorityToNumber from "../migrations/migratePriorityToNumber.js";
import type * as migrations_populateUserClinics from "../migrations/populateUserClinics.js";
import type * as migrations_reactivateSystemClinics from "../migrations/reactivateSystemClinics.js";
import type * as migrations_removeCategoryAttributeClinicId from "../migrations/removeCategoryAttributeClinicId.js";
import type * as migrations_removeCategoryClinicId from "../migrations/removeCategoryClinicId.js";
import type * as migrations_resetUserSyncTimestamps from "../migrations/resetUserSyncTimestamps.js";
import type * as migrations_updateSystemClinics from "../migrations/updateSystemClinics.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as primoupActions from "../primoupActions.js";
import type * as primoupAuth from "../primoupAuth.js";
import type * as primoupMutations from "../primoupMutations.js";
import type * as roles from "../roles.js";
import type * as slaRules from "../slaRules.js";
import type * as societies from "../societies.js";
import type * as systemClinics from "../systemClinics.js";
import type * as tags from "../tags.js";
import type * as testAuth from "../testAuth.js";
import type * as ticketAttributes from "../ticketAttributes.js";
import type * as ticketComments from "../ticketComments.js";
import type * as ticketStatuses from "../ticketStatuses.js";
import type * as ticketViews from "../ticketViews.js";
import type * as tickets from "../tickets.js";
import type * as ticketsToManage from "../ticketsToManage.js";
import type * as triggers from "../triggers.js";
import type * as userClinics from "../userClinics.js";
import type * as userCompetencies from "../userCompetencies.js";
import type * as userSocieties from "../userSocieties.js";
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
  autoAssignSociety: typeof autoAssignSociety;
  categories: typeof categories;
  categoryAttributes: typeof categoryAttributes;
  clinics: typeof clinics;
  comments: typeof comments;
  counters: typeof counters;
  debugDomainSociety: typeof debugDomainSociety;
  departments: typeof departments;
  domainSocieties: typeof domainSocieties;
  init: typeof init;
  kbArticles: typeof kbArticles;
  kbComments: typeof kbComments;
  "lib/permissions": typeof lib_permissions;
  "lib/utils": typeof lib_utils;
  macros: typeof macros;
  makeAdmin: typeof makeAdmin;
  "migrations/cleanDuplicateClinics": typeof migrations_cleanDuplicateClinics;
  "migrations/initializeTicketStatuses": typeof migrations_initializeTicketStatuses;
  "migrations/migratePriorityToNumber": typeof migrations_migratePriorityToNumber;
  "migrations/populateUserClinics": typeof migrations_populateUserClinics;
  "migrations/reactivateSystemClinics": typeof migrations_reactivateSystemClinics;
  "migrations/removeCategoryAttributeClinicId": typeof migrations_removeCategoryAttributeClinicId;
  "migrations/removeCategoryClinicId": typeof migrations_removeCategoryClinicId;
  "migrations/resetUserSyncTimestamps": typeof migrations_resetUserSyncTimestamps;
  "migrations/updateSystemClinics": typeof migrations_updateSystemClinics;
  notifications: typeof notifications;
  presence: typeof presence;
  primoupActions: typeof primoupActions;
  primoupAuth: typeof primoupAuth;
  primoupMutations: typeof primoupMutations;
  roles: typeof roles;
  slaRules: typeof slaRules;
  societies: typeof societies;
  systemClinics: typeof systemClinics;
  tags: typeof tags;
  testAuth: typeof testAuth;
  ticketAttributes: typeof ticketAttributes;
  ticketComments: typeof ticketComments;
  ticketStatuses: typeof ticketStatuses;
  ticketViews: typeof ticketViews;
  tickets: typeof tickets;
  ticketsToManage: typeof ticketsToManage;
  triggers: typeof triggers;
  userClinics: typeof userClinics;
  userCompetencies: typeof userCompetencies;
  userSocieties: typeof userSocieties;
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
