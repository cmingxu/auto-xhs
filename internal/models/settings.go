package models

import "time"

type Settings struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	Key       string    `json:"key" gorm:"uniqueIndex;size:128"`
	Value     string    `json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}
