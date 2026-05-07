package models

import "time"

type Note struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	NoteID    string    `json:"note_id" gorm:"uniqueIndex;size:64"`
	Title     string    `json:"title" gorm:"size:512"`
	Content   string    `json:"content" gorm:"size:4096"`
	Tags      string    `json:"tags"`
	Date      string    `json:"date" gorm:"size:64"`
	URL       string    `json:"url" gorm:"size:1024"`
	ScrapedAt int64     `json:"scraped_at"`
	CreatedAt time.Time `json:"created_at"`
}
