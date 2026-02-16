package main

import (
	"log"
	"os"
	"pooled-storage/internal/api"
	"pooled-storage/internal/database"
	"pooled-storage/internal/rclone"
	"pooled-storage/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	db, err := database.InitDB()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize rclone manager
	rcloneManager := rclone.NewManager()

	// Initialize services
	accountService := services.NewAccountService(db, rcloneManager)
	storageService := services.NewStorageService(db, rcloneManager)
	statsService := services.NewStatsService(db, rcloneManager)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Pooled Storage Manager",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// API routes
	apiRouter := app.Group("/api")
	
	// Health check
	apiRouter.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
			"version": "1.0.0",
		})
	})

	// Initialize API handlers
	api.SetupAccountRoutes(apiRouter, accountService)
	api.SetupStorageRoutes(apiRouter, storageService)
	api.SetupStatsRoutes(apiRouter, statsService)
	api.SetupOAuthRoutes(apiRouter, accountService)
	api.SetupSettingsRoutes(apiRouter, db)

	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start server
	log.Printf("Starting Pooled Storage Manager on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
