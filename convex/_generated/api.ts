/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authPasswordResetEmail from "../authPasswordResetEmail.js";
import type * as authz from "../authz.js";
import type * as barcode from "../barcode.js";
import type * as brands from "../brands.js";
import type * as clientSearch from "../clientSearch.js";
import type * as clients from "../clients.js";
import type * as creditLedgerUpdateRequests from "../creditLedgerUpdateRequests.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataBackup from "../dataBackup.js";
import type * as dataBackupHelpers from "../dataBackupHelpers.js";
import type * as defaultCatalog from "../defaultCatalog.js";
import type * as deleteCascade from "../deleteCascade.js";
import type * as devices from "../devices.js";
import type * as http from "../http.js";
import type * as installmentMath from "../installmentMath.js";
import type * as installmentPlans from "../installmentPlans.js";
import type * as invoiceCreditAdjustments from "../invoiceCreditAdjustments.js";
import type * as invoiceNumbers from "../invoiceNumbers.js";
import type * as invoiceVerification from "../invoiceVerification.js";
import type * as invoices from "../invoices.js";
import type * as jamaaClientImport from "../jamaaClientImport.js";
import type * as jamaaProductImport from "../jamaaProductImport.js";
import type * as matjarCsvCatalog from "../matjarCsvCatalog.js";
import type * as money from "../money.js";
import type * as passwordPolicy from "../passwordPolicy.js";
import type * as passwords from "../passwords.js";
import type * as perfBaseline from "../perfBaseline.js";
import type * as pos from "../pos.js";
import type * as posCartDrafts from "../posCartDrafts.js";
import type * as posHistoryUpdates from "../posHistoryUpdates.js";
import type * as posQty from "../posQty.js";
import type * as posReopen from "../posReopen.js";
import type * as procurement from "../procurement.js";
import type * as productCsvImport from "../productCsvImport.js";
import type * as productImageMirror from "../productImageMirror.js";
import type * as productImageMirrorActions from "../productImageMirrorActions.js";
import type * as products from "../products.js";
import type * as profile from "../profile.js";
import type * as pushAlertDigest from "../pushAlertDigest.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as rbac from "../rbac.js";
import type * as returns from "../returns.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as sharePdfs from "../sharePdfs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  audit: typeof audit;
  auth: typeof auth;
  authPasswordResetEmail: typeof authPasswordResetEmail;
  authz: typeof authz;
  barcode: typeof barcode;
  brands: typeof brands;
  clientSearch: typeof clientSearch;
  clients: typeof clients;
  creditLedgerUpdateRequests: typeof creditLedgerUpdateRequests;
  credits: typeof credits;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataBackup: typeof dataBackup;
  dataBackupHelpers: typeof dataBackupHelpers;
  defaultCatalog: typeof defaultCatalog;
  deleteCascade: typeof deleteCascade;
  devices: typeof devices;
  http: typeof http;
  installmentMath: typeof installmentMath;
  installmentPlans: typeof installmentPlans;
  invoiceCreditAdjustments: typeof invoiceCreditAdjustments;
  invoiceNumbers: typeof invoiceNumbers;
  invoiceVerification: typeof invoiceVerification;
  invoices: typeof invoices;
  jamaaClientImport: typeof jamaaClientImport;
  jamaaProductImport: typeof jamaaProductImport;
  matjarCsvCatalog: typeof matjarCsvCatalog;
  money: typeof money;
  passwordPolicy: typeof passwordPolicy;
  passwords: typeof passwords;
  perfBaseline: typeof perfBaseline;
  pos: typeof pos;
  posCartDrafts: typeof posCartDrafts;
  posHistoryUpdates: typeof posHistoryUpdates;
  posQty: typeof posQty;
  posReopen: typeof posReopen;
  procurement: typeof procurement;
  productCsvImport: typeof productCsvImport;
  productImageMirror: typeof productImageMirror;
  productImageMirrorActions: typeof productImageMirrorActions;
  products: typeof products;
  profile: typeof profile;
  pushAlertDigest: typeof pushAlertDigest;
  pushNotifications: typeof pushNotifications;
  pushSubscriptions: typeof pushSubscriptions;
  rbac: typeof rbac;
  returns: typeof returns;
  seed: typeof seed;
  settings: typeof settings;
  sharePdfs: typeof sharePdfs;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
