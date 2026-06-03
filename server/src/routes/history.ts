import { Router, type Router as RouterType } from 'express';
import { getSearchHistory, clearSearchHistory } from '../db/index';

export const historyRouter: RouterType = Router();

historyRouter.get('/', (_req, res) => {
  res.json(getSearchHistory());
});

historyRouter.delete('/', (_req, res) => {
  clearSearchHistory();
  res.json({ ok: true });
});
