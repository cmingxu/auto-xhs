package models

import "time"

type AIComment struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	CommentID   string    `json:"comment_id" gorm:"uniqueIndex;size:64"`
	NoteTitle   string    `json:"note_title" gorm:"size:512"`
	NoteContent string    `json:"note_content" gorm:"size:4096"`
	Comment     string    `json:"comment" gorm:"size:4096"`
	NoteURL     string    `json:"note_url" gorm:"size:1024"`
	CreatedAt   time.Time `json:"created_at"`
}
