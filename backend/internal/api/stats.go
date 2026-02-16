package api

import (
	"pooled-storage/internal/services"

	"github.com/gofiber/fiber/v2"
)

func SetupStatsRoutes(router fiber.Router, service *services.StatsService) {
	stats := router.Group("/stats")

	stats.Get("/", func(c *fiber.Ctx) error {
		stats, err := service.GetStorageStats()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(stats)
	})

	stats.Get("/accounts", func(c *fiber.Ctx) error {
		stats, err := service.GetAccountStats()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(stats)
	})

	stats.Get("/pools", func(c *fiber.Ctx) error {
		stats, err := service.GetPoolStats()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(stats)
	})

	stats.Post("/refresh", func(c *fiber.Ctx) error {
		if err := service.RefreshAllQuotas(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"message": "Quotas refreshed"})
	})
}
