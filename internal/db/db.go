package db

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"auto-xhs/internal/models"
)

type Store struct {
	db     *gorm.DB
	driver string
}

type OpenConfig struct {
	Driver string
	DSN    string
}

func Open(ctx context.Context, cfg OpenConfig) (*Store, error) {
	driver := strings.ToLower(strings.TrimSpace(cfg.Driver))
	if driver == "" {
		driver = "sqlite"
	}

	dsn := strings.TrimSpace(cfg.DSN)
	if dsn == "" {
		if driver == "sqlite" {
			dsn = "var/db/app.sqlite"
		} else {
			return nil, errors.New("dsn is required")
		}
	}

	if driver == "sqlite" {
		if err := ensureSQLiteDir(dsn); err != nil {
			return nil, err
		}
	}

	var dialector gorm.Dialector
	switch driver {
	case "sqlite":
		dialector = sqlite.Open(dsn)
	case "postgres", "pgx":
		dialector = postgres.Open(dsn)
	default:
		return nil, errors.New("unsupported db driver")
	}

	gdb, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		return nil, err
	}

	s := &Store{db: gdb, driver: driver}
	if err := s.Migrate(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

func (s *Store) Migrate(ctx context.Context) error {
	if err := s.db.WithContext(ctx).AutoMigrate(
		&models.SystemConfig{},
		&models.User{},
		&models.XhsUser{},
		&models.Note{},
		&models.Comment{},
		&models.AIComment{},
		&models.Settings{},
	); err != nil {
		return err
	}

	_, err := s.GetSystemConfig(ctx)
	return err
}

// --- SystemConfig ---

func (s *Store) GetSystemConfig(ctx context.Context) (models.SystemConfig, error) {
	var cfg models.SystemConfig
	err := s.db.WithContext(ctx).First(&cfg, 1).Error
	if err == nil {
		return cfg, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.SystemConfig{}, err
	}

	cfg = models.DefaultSystemConfig()
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(&cfg).Error; err != nil {
		return models.SystemConfig{}, err
	}

	if err := s.db.WithContext(ctx).First(&cfg, 1).Error; err != nil {
		return models.SystemConfig{}, err
	}
	return cfg, nil
}

type SystemConfigUpdate struct {
	WarnText *string
}

func (s *Store) UpdateSystemConfig(ctx context.Context, u SystemConfigUpdate) (models.SystemConfig, error) {
	cfg, err := s.GetSystemConfig(ctx)
	if err != nil {
		return models.SystemConfig{}, err
	}

	if u.WarnText != nil {
		cfg.WarnText = strings.TrimSpace(*u.WarnText)
	}

	cfg.UpdatedAtUTC = time.Now().UTC()
	if err := s.db.WithContext(ctx).Save(&cfg).Error; err != nil {
		return models.SystemConfig{}, err
	}
	return cfg, nil
}

// --- Auth User (dashboard login) ---

func (s *Store) GetUserByNickname(ctx context.Context, nickname string) (models.User, error) {
	var user models.User
	err := s.db.WithContext(ctx).Where("nickname = ?", nickname).First(&user).Error
	return user, err
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (models.User, error) {
	var user models.User
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	return user, err
}

func (s *Store) CreateUser(ctx context.Context, user models.User) (models.User, error) {
	_, err := s.GetUserByNickname(ctx, user.Nickname)
	if err == nil {
		return models.User{}, errors.New("nickname already exists")
	}

	err = s.db.WithContext(ctx).Create(&user).Error
	return user, err
}

func (s *Store) UpdateUserPassword(ctx context.Context, userID int64, password string) error {
	return s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Update("password", password).Error
}

func (s *Store) ListUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := s.db.WithContext(ctx).Find(&users).Error
	return users, err
}

func (s *Store) CreateDefaultUser(ctx context.Context) error {
	_, err := s.GetUserByNickname(ctx, "admin")
	if err == nil {
		return nil
	}

	_, err = s.CreateUser(ctx, models.User{
		Nickname: "admin",
		Password: "admin",
	})
	return err
}

func (s *Store) DeleteUser(ctx context.Context, id int64) error {
	var count int64
	s.db.WithContext(ctx).Model(&models.User{}).Count(&count)
	if count <= 1 {
		return errors.New("cannot delete last user")
	}
	return s.db.WithContext(ctx).Delete(&models.User{}, id).Error
}

// --- XhsUser ---

func (s *Store) UpsertXhsUser(ctx context.Context, u models.XhsUser) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		UpdateAll: true,
	}).Create(&u).Error
}

func (s *Store) ListXhsUsers(ctx context.Context) ([]models.XhsUser, error) {
	var users []models.XhsUser
	err := s.db.WithContext(ctx).Order("created_at DESC").Find(&users).Error
	return users, err
}

func (s *Store) CountXhsUsers(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.XhsUser{}).Count(&count).Error
	return count, err
}

func (s *Store) DeleteXhsUser(ctx context.Context, userID string) error {
	return s.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.XhsUser{}).Error
}

// --- Note ---

func (s *Store) UpsertNote(ctx context.Context, n models.Note) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "note_id"}},
		UpdateAll: true,
	}).Create(&n).Error
}

func (s *Store) ListNotes(ctx context.Context) ([]models.Note, error) {
	var notes []models.Note
	err := s.db.WithContext(ctx).Order("created_at DESC").Find(&notes).Error
	return notes, err
}

func (s *Store) CountNotes(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.Note{}).Count(&count).Error
	return count, err
}

func (s *Store) DeleteNote(ctx context.Context, noteID string) error {
	return s.db.WithContext(ctx).Where("note_id = ?", noteID).Delete(&models.Note{}).Error
}

// --- Comment ---

func (s *Store) UpsertComment(ctx context.Context, c models.Comment) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "comment_id"}},
		UpdateAll: true,
	}).Create(&c).Error
}

func (s *Store) ListComments(ctx context.Context) ([]models.Comment, error) {
	var comments []models.Comment
	err := s.db.WithContext(ctx).Order("created_at DESC").Find(&comments).Error
	return comments, err
}

func (s *Store) CountComments(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.Comment{}).Count(&count).Error
	return count, err
}

func (s *Store) DeleteComment(ctx context.Context, commentID string) error {
	return s.db.WithContext(ctx).Where("comment_id = ?", commentID).Delete(&models.Comment{}).Error
}

// --- AIComment ---

func (s *Store) UpsertAIComment(ctx context.Context, c models.AIComment) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "comment_id"}},
		UpdateAll: true,
	}).Create(&c).Error
}

func (s *Store) ListAIComments(ctx context.Context) ([]models.AIComment, error) {
	var comments []models.AIComment
	err := s.db.WithContext(ctx).Order("created_at DESC").Find(&comments).Error
	return comments, err
}

func (s *Store) CountAIComments(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.AIComment{}).Count(&count).Error
	return count, err
}

func (s *Store) DeleteAIComment(ctx context.Context, commentID string) error {
	return s.db.WithContext(ctx).Where("comment_id = ?", commentID).Delete(&models.AIComment{}).Error
}

// --- Settings ---

func (s *Store) UpsertSetting(ctx context.Context, setting models.Settings) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		UpdateAll: true,
	}).Create(&setting).Error
}

func (s *Store) ListSettings(ctx context.Context) ([]models.Settings, error) {
	var settings []models.Settings
	err := s.db.WithContext(ctx).Order("key ASC").Find(&settings).Error
	return settings, err
}

func (s *Store) GetSetting(ctx context.Context, key string) (models.Settings, error) {
	var s2 models.Settings
	err := s.db.WithContext(ctx).Where("key = ?", key).First(&s2).Error
	return s2, err
}

// --- Dashboard Stats ---

type DashboardStats struct {
	XhsUserCount   int64 `json:"xhs_user_count"`
	NoteCount      int64 `json:"note_count"`
	CommentCount   int64 `json:"comment_count"`
	AICommentCount int64 `json:"ai_comment_count"`
	SettingCount   int64 `json:"setting_count"`
}

func (s *Store) GetDashboardStats(ctx context.Context) (DashboardStats, error) {
	var stats DashboardStats
	var err error

	stats.XhsUserCount, err = s.CountXhsUsers(ctx)
	if err != nil {
		return stats, err
	}
	stats.NoteCount, err = s.CountNotes(ctx)
	if err != nil {
		return stats, err
	}
	stats.CommentCount, err = s.CountComments(ctx)
	if err != nil {
		return stats, err
	}
	stats.AICommentCount, err = s.CountAIComments(ctx)
	if err != nil {
		return stats, err
	}
	err = s.db.WithContext(ctx).Model(&models.Settings{}).Count(&stats.SettingCount).Error
	return stats, err
}

func ensureSQLiteDir(dsn string) error {
	path := strings.TrimSpace(dsn)
	if strings.HasPrefix(path, "file:") {
		path = strings.TrimPrefix(path, "file:")
	}
	if i := strings.IndexByte(path, '?'); i >= 0 {
		path = path[:i]
	}
	path = strings.TrimSpace(path)
	if path == "" || path == ":memory:" {
		return nil
	}

	dir := filepath.Dir(path)
	if dir == "." || dir == "/" {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	return nil
}
