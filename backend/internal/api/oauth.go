package api

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"pooled-storage/internal/models"
	"pooled-storage/internal/services"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/microsoft"
)

func SetupOAuthRoutes(router fiber.Router, service *services.AccountService) {
	oauth := router.Group("/oauth")

	oauth.Post("/start", func(c *fiber.Ctx) error {
		var req models.OAuthStartRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		config, err := getOAuthConfig(req.Provider)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		state := fmt.Sprintf("%s_%d", req.Provider, c.Context().Time().Unix())
		url := config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)

		return c.JSON(fiber.Map{
			"url":   url,
			"state": state,
		})
	})

	oauth.Post("/callback", func(c *fiber.Ctx) error {
		var req models.OAuthCallbackRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		config, err := getOAuthConfig(req.Provider)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		token, err := config.Exchange(context.Background(), req.Code)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Failed to exchange token"})
		}

		// Get user email
		email, err := getUserEmail(req.Provider, token.AccessToken)
		if err != nil {
			email = "unknown@example.com"
		}

		// Create account
		createReq := &models.CreateAccountRequest{
			Name:  fmt.Sprintf("%s Account", req.Provider),
			Type:  req.Provider,
			Email: email,
			Token: token.AccessToken,
		}

		account, err := service.CreateAccount(createReq)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(account)
	})

	oauth.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"google_configured":    os.Getenv("GOOGLE_CLIENT_ID") != "",
			"microsoft_configured": os.Getenv("MICROSOFT_CLIENT_ID") != "",
		})
	})
}

func getOAuthConfig(provider string) (*oauth2.Config, error) {
	hostIP := os.Getenv("HOST_IP")
	if hostIP == "" {
		hostIP = "192.168.100.14"
	}

	redirectURL := fmt.Sprintf("http://%s:20080/api/oauth/callback", hostIP)

	switch provider {
	case "google":
		clientID := os.Getenv("GOOGLE_CLIENT_ID")
		clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
		if clientID == "" || clientSecret == "" {
			return nil, fmt.Errorf("Google OAuth not configured")
		}

		return &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"https://www.googleapis.com/auth/drive"},
			Endpoint:     google.Endpoint,
		}, nil

	case "microsoft":
		clientID := os.Getenv("MICROSOFT_CLIENT_ID")
		clientSecret := os.Getenv("MICROSOFT_CLIENT_SECRET")
		if clientID == "" || clientSecret == "" {
			return nil, fmt.Errorf("Microsoft OAuth not configured")
		}

		return &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"https://graph.microsoft.com/Files.ReadWrite.All", "offline_access"},
			Endpoint:     microsoft.AzureADEndpoint("common"),
		}, nil

	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

func getUserEmail(provider, accessToken string) (string, error) {
	// This is a simplified version - in production, you'd make actual API calls
	return fmt.Sprintf("user@%s.com", provider), nil
}

func SetupSettingsRoutes(router fiber.Router, db interface{}) {
	settings := router.Group("/settings")

	settings.Get("/oauth", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"google": fiber.Map{
				"configured": os.Getenv("GOOGLE_CLIENT_ID") != "",
			},
			"microsoft": fiber.Map{
				"configured": os.Getenv("MICROSOFT_CLIENT_ID") != "",
			},
		})
	})

	settings.Get("/system", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"host_ip":    os.Getenv("HOST_IP"),
			"mount_path": os.Getenv("MOUNT_PATH"),
			"version":    "1.0.0",
		})
	})
}
