import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:600000,workers:1,use:{baseURL:process.env.PEDAL_TEST_URL??'http://127.0.0.1:5173',headless:true},reporter:'list'});
