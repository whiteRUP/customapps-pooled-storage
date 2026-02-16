package api

import (
	"pooled-storage/internal/models"
	"pooled-storage/internal/services"

	"github.com/gofiber/fiber/v2"
)

func SetupAccountRoutes(router fiber.Router, service *services.AccountService) {
	accounts := router.Group("/accounts")

	accounts.Get("/", func(c *fiber.Ctx) error {
		accounts, err := service.GetAccounts()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(accounts)
	})

	accounts.Get("/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		account, err := service.GetAccount(id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Account not found"})
		}
		return c.JSON(account)
	})

	accounts.Post("/", func(c *fiber.Ctx) error {
		var req models.CreateAccountRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		account, err := service.CreateAccount(&req)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.Status(201).JSON(account)
	})

	accounts.Delete("/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		if err := service.DeleteAccount(id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"message": "Account deleted successfully"})
	})

	accounts.Post("/:id/refresh", func(c *fiber.Ctx) error {
		id := c.Params("id")
		if err := service.RefreshQuota(id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		
		account, _ := service.GetAccount(id)
		return c.JSON(account)
	})

	accounts.Put("/:id/status", func(c *fiber.Ctx) error {
		id := c.Params("id")
		var req struct {
			Status string `json:"status"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if err := service.UpdateAccountStatus(id, req.Status); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"message": "Status updated"})
	})
}
