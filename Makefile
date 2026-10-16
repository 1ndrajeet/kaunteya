.PHONY: help install dev dev-web dev-server lint format format-check typecheck test check build clean

SHELL := /bin/bash

help:
	@echo "Available commands:"
	@echo "  make install       Install frontend and backend dependencies"
	@echo "  make dev           Start both frontend and backend concurrently"
	@echo "  make dev-web       Start Next.js frontend only"
	@echo "  make dev-server    Start FastAPI backend only"
	@echo "  make lint          Run ESLint (web) and Ruff (server)"
	@echo "  make format        Format web and server source code"
	@echo "  make format-check  Check formatting without modifying files"
	@echo "  make typecheck     Run TypeScript checks in web"
	@echo "  make test          Run backend pytest suite"
	@echo "  make check         Run linting, typechecking, tests, and format check"
	@echo "  make build         Build Next.js production bundle"
	@echo "  make clean         Clean build artifacts and caches"

install:
	@echo "==> Installing backend dependencies with uv..."
	cd backend && uv sync
	@echo "==> Installing frontend dependencies with pnpm..."
	cd frontend && pnpm install

dev:
	@echo "Starting Next.js frontend (http://localhost:3000)..."
	cd frontend && pnpm dev

dev-web:
	cd frontend && pnpm dev

dev-server:
	cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

lint:
	@echo "==> Linting frontend..."
	cd frontend && pnpm run lint

format:
	@echo "==> Formatting frontend..."
	cd frontend && pnpm run format

format-check:
	@echo "==> Checking frontend formatting..."
	cd frontend && pnpm run format:check

typecheck:
	@echo "==> Checking frontend types..."
	cd frontend && pnpm run typecheck

test:
	@echo "==> Running backend tests..."
	cd backend && uv run pytest

check: lint format-check typecheck
	@echo ""
	@echo "✓ All repository quality checks passed successfully!"

build:
	@echo "==> Building frontend production bundle..."
	cd frontend && pnpm run build

clean:
	@echo "==> Cleaning cache and build artifacts..."
	rm -rf frontend/.next frontend/out frontend/dist backend/.pytest_cache backend/.ruff_cache backend/__pycache__
