from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId

class TaskStatus(str, Enum):
    TODO = "To Do"
    DOING = "Doing"
    DONE = "Done"

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    title: str
    description: Optional[str] = None
    assignedTo: str  # User ID
    assignedBy: str  # User ID
    groupId: str  # Group ID
    deadline: datetime
    status: TaskStatus = TaskStatus.TODO
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "title": "Prepare meeting notes",
                "description": "Create notes for tomorrow's meeting",
                "assignedTo": "user123",
                "assignedBy": "user456",
                "groupId": "group789",
                "deadline": "2023-06-15T14:00:00Z",
                "status": "To Do"
            }
        }