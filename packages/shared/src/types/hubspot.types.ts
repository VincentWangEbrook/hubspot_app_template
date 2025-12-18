/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

export interface HubspotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    createdate?: string;
    [key: string]: any;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}
