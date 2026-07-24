run-backend:
	docker compose -f docker-compose.backend-test.yml up -d
	docker compose -f docker-compose.backend-test.yml exec backend python manage.py migrate

stop-backend:
	docker compose -f docker-compose.backend-test.yml down

reload:
	docker compose -f docker-compose.backend-test.yml restart backend

create-parent:
	docker compose exec backend ./scripts/create_initial_parent.sh

deploy:
	docker compose up -d --build

undeploy:
	docker compose down
