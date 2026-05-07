package models

import "time"

type XhsUser struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID      string    `json:"user_id" gorm:"uniqueIndex;size:64"`
	Nickname    string    `json:"nickname" gorm:"size:128"`
	Images      string    `json:"images" gorm:"size:1024"`
	Desc        string    `json:"desc" gorm:"size:2048"`
	Follows     string    `json:"follows" gorm:"size:32"`
	Fans        string    `json:"fans" gorm:"size:32"`
	Interaction string    `json:"interaction" gorm:"size:32"`
	XsecToken   string    `json:"xsec_token" gorm:"size:256"`
	Notes       string    `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
