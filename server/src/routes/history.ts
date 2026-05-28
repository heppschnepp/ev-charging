import { Router, type Router as RouterType } from 'express';
import { getSearchHistory } from '../db/index.js';

export const historyRouter: RouterType = Router();

historyRouter.get('/', (_req, res) => {
  res.json(getSearchHistory());
});
