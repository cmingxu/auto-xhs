package models

import "time"

type Comment struct {
	ID         int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	CommentID  string    `json:"comment_id" gorm:"uniqueIndex;size:64"`
	NoteID     string    `json:"note_id" gorm:"index;size:64"`
	Content    string    `json:"content" gorm:"size:4096"`
	UserID     string    `json:"user_id" gorm:"size:64"`
	Nickname   string    `json:"nickname" gorm:"size:128"`
	Image      string    `json:"image" gorm:"size:1024"`
	IPLocation string    `json:"ip_location" gorm:"size:64"`
	CreateTime int64     `json:"create_time"`
	LikeCount  string    `json:"like_count" gorm:"size:32"`
	XsecToken  string    `json:"xsec_token" gorm:"size:256"`
	CreatedAt  time.Time `json:"created_at"`
}
