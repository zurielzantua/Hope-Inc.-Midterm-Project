#!/usr/bin/env bash
set -e

npx supabase db push --dry-run

read -r -p "Push to the shared database? (y/N) " confirmation
if [ "$confirmation" = "y" ]; then
  npx supabase db push
else
  echo "Push cancelled."
fi
