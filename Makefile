run-backend:
	docker compose -f docker-compose.backend-test.yml up -d
	sleep 5
	docker compose -f docker-compose.backend-test.yml exec backend python manage.py migrate

stop-backend:
	docker compose -f docker-compose.backend-test.yml down

reload:
	docker compose -f docker-compose.backend-test.yml restart backend
