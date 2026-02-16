package api

import (
	"pooled-storage/internal/models"
	"pooled-storage/internal/services"

	"github.com/gofiber/fiber/v2"
)

func SetupStorageRoutes(router fiber.Router, service *services.StorageService) {
	pools := router.Group("/pools")

	pools.Get("/", func(c *fiber.Ctx) error {
		pools, err := service.GetPools()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(pools)
	})

	pools.Get("/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		pool, err := service.GetPool(id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Pool not found"})
		}
		return c.JSON(pool)
	})

	pools.Post("/", func(c *fiber.Ctx) error {
		var req models.CreatePoolRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		pool, err := service.CreatePool(&req)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.Status(201).JSON(pool)
	})

	pools.Delete("/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		if err := service.DeletePool(id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"message": "Pool deleted successfully"})
	})

	pools.Post("/:id/start", func(c *fiber.Ctx) error {
		id := c.Params("id")
		if err := service.StartPool(id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		
		pool, _ := service.GetPool(id)
		return c.JSON(pool)
	})

	pools.Post("/:id/stop", func(c *fiber.Ctx) error {
		id := c.Params("id")
		if err := service.StopPool(id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		
		pool, _ := service.GetPool(id)
		return c.JSON(pool)
	})

	pools.Post("/:id/accounts", func(c *fiber.Ctx) error {
		id := c.Params("id")
		var req struct {
			AccountID string `json:"account_id"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if err := service.AddAccountToPool(id, req.AccountID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"message": "Account added to pool"})
	})

	pools.Delete("/:id/accounts/:accountId", func(c *fiber.Ctx) error {
		poolId := c.Params("id")
		accountId := c.Params("accountId")

		if err := service.RemoveAccountFromPool(poolId, accountId); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"message": "Account removed from pool"})
	})
}
